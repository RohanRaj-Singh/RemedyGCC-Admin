/**
 * Response Repository
 *
 * Data-access layer for the rawResponses MongoDB collection.
 * Follows the existing pattern in src/server/scanner/repository.ts.
 */

import 'server-only';
import { runMongoScript } from '../mongo-shell';

// ---------------------------------------------------------------------------
// Types — mirror the canonical response contract (docs/contracts/canonical-response-contract.md)
// ---------------------------------------------------------------------------

export interface RawResponseRow {
  responseId: string;
  questionId: string;
  questionKind: 'primary' | 'follow-up';
  triggerQuestionId?: string;
  answerId: string;
  answerScore: number;
  answeredAt: string;
  timeSpentMs?: number;
}

export interface RawResponseDocument {
  submissionId: string;
  tenantId: string;
  runtimeConfigId: string;
  scannerVersionId: string;
  attributeTemplateVersionId: string;
  calculationVersionId: string;
  submittedAt: string;
  completionState: {
    status: string;
    startedAt?: string;
    completedAt?: string;
    totalQuestions: number;
    answeredQuestions: number;
  };
  /** May be a structured object or flat combined string depending on data age */
  attributes: Record<string, string>;
  responses: RawResponseRow[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all completed survey responses for a given tenant.
 *
 * Only returns documents where completionState.status === "completed".
 * Results are ordered most-recent-first.
 */
export async function getCompletedResponsesForTenant(
  tenantId: string,
): Promise<RawResponseDocument[]> {
  return runMongoScript<RawResponseDocument[]>(
    `
const docs = db.rawResponses.find(
  {
    tenantId: __payload.tenantId,
    "completionState.status": "completed"
  },
  { projection: { _id: 0 } }
)
.sort({ submittedAt: -1 })
.toArray();

__emit(__strip(docs));
`,
    { tenantId },
    { label: 'get-completed-responses' },
  );
}

/**
 * Fetch distinct scannerVersionId values with completed responses for a tenant.
 * Used to determine which scanner versions are referenced before resolving labels.
 */
export async function getDistinctScannerVersionsForTenant(
  tenantId: string,
): Promise<string[]> {
  return runMongoScript<string[]>(
    `
const ids = db.rawResponses.distinct("scannerVersionId", {
  tenantId: __payload.tenantId,
  "completionState.status": "completed"
});

__emit(__strip(ids));
`,
    { tenantId },
    { label: 'get-distinct-scanner-versions' },
  );
}

/**
 * Fetch a runtime config snapshot from the runtimeConfigs collection.
 *
 * rawResponses.runtimeConfigId references this collection.
 * The document embeds the full scannerVersion tree, including question
 * text and answer option labels.
 */
export async function getRuntimeConfigById(
  runtimeConfigId: string,
): Promise<Record<string, unknown> | null> {
  return runMongoScript<Record<string, unknown> | null>(
    `
const config = db.runtimeConfigs.findOne(
  { runtimeConfigId: __payload.runtimeConfigId },
  { projection: { _id: 0 } }
);

if (!config) {
  __emit(null);
  return;
}

__emit(__strip(config));
`,
    { runtimeConfigId },
    { label: 'get-runtime-config' },
  );
}

/**
 * Fetch the first completed response's full document (unstructured)
 * to inspect the attribute shape. Useful for debugging attribute format.
 */
export async function peekFirstResponseAttributes(
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  return runMongoScript<Record<string, unknown> | null>(
    `
const doc = db.rawResponses.findOne(
  { tenantId: __payload.tenantId, "completionState.status": "completed" },
  { projection: { _id: 0 } }
);

if (!doc) {
  __emit(null);
  return;
}

// Emit only the attributes and submissionId to keep it small
__emit(__strip({
  submissionId: doc.submissionId,
  attributes: typeof doc.attributes === 'object' && doc.attributes !== null
    ? doc.attributes
    : { _raw: String(doc.attributes) },
  attributeKeys: typeof doc.attributes === 'object' && doc.attributes !== null
    ? Object.keys(doc.attributes)
    : [],
  attributeValues: typeof doc.attributes === 'object' && doc.attributes !== null
    ? Object.values(doc.attributes)
    : [String(doc.attributes)],
}));
`,
    { tenantId },
    { label: 'peek-response-attributes' },
  );
}

/**
 * Fetch distinct runtimeConfigId values with completed responses for a tenant.
 */
export async function getDistinctRuntimeConfigIdsForTenant(
  tenantId: string,
): Promise<string[]> {
  return runMongoScript<string[]>(
    `
const ids = db.rawResponses.distinct("runtimeConfigId", {
  tenantId: __payload.tenantId,
  "completionState.status": "completed"
});

__emit(__strip(ids));
`,
    { tenantId },
    { label: 'get-distinct-runtime-configs' },
  );
}
