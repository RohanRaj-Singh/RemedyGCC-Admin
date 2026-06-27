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
