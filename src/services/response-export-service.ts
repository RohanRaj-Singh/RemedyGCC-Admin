/**
 * Response Export Service
 *
 * Orchestrates the end-to-end export workflow:
 *   read completed responses → resolve scanner version → build column definitions
 *   → map answer IDs to labels → generate workbook → return buffer
 *
 * Follows the project architecture: service layer owns business logic,
 * repository layer owns data access, workbook generator is a pure utility.
 */

import 'server-only';

import { getTenantById } from '@/modules/tenant/service';
import {
  getCompletedResponsesForTenant,
  getRuntimeScannerVersionById,
} from '@/server/response/repository';
import type { RawResponseDocument } from '@/server/response/repository';
import type { RuntimeScannerVersion } from '@/types/runtime-config';
import { createWorkbook } from '@/lib/excel/workbook-generator';
import type { ColumnDefinition, ExportRow } from '@/lib/excel/workbook-generator';

// ---------------------------------------------------------------------------
// Constants — demographic attribute order and label mapping
// ---------------------------------------------------------------------------

const ATTRIBUTE_KEYS = ['stream', 'location', 'function', 'department', 'gender', 'age', 'seniority'] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExportResult {
  /** Generated .xlsx file buffer */
  buffer: Buffer;
  /** Suggested filename (e.g. "AcmeHealth_Responses_2026-06-28.xlsx") */
  filename: string;
  /** Number of completed submissions included in the export */
  responseCount: number;
}

/**
 * Generate an xlsx export of completed survey responses for a tenant.
 *
 * - Resolves the tenant for filenaming
 * - Fetches all completed rawResponses
 * - Resolves the published scanner version for column definitions
 * - Maps answer IDs to human-readable labels
 * - Returns a ready-to-download buffer
 *
 * Throws descriptive errors that the API route can return as user-friendly
 * messages (no internal details exposed).
 */
export async function generateResponseExport(tenantId: string): Promise<ExportResult> {
  // ---- Step 1: Resolve tenant -------------------------------------------
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  // ---- Step 2: Read completed responses ---------------------------------
  const responses = await getCompletedResponsesForTenant(tenantId);
  if (responses.length === 0) {
    throw new Error('No completed survey responses found for this tenant.');
  }

  // ---- Step 3: Resolve scanner version ----------------------------------
  const scannerVersionId = resolveScannerVersionId(responses);
  const rawVersion = await getRuntimeScannerVersionById(scannerVersionId);
  if (!rawVersion) {
    throw new Error(
      'The scanner version associated with these responses could not be found. ' +
      'The published scanner may have been removed.',
    );
  }
  const scannerVersion = rawVersion as unknown as RuntimeScannerVersion;

  // ---- Step 4: Build structures -----------------------------------------
  const answerLabels = buildAnswerLabelMap(scannerVersion);
  const columns = buildColumns(scannerVersion);
  const rows = buildRows(responses, columns, answerLabels);

  // ---- Step 5: Generate workbook ----------------------------------------
  const buffer = createWorkbook('Responses', columns, rows);

  // ---- Step 6: Build filename -------------------------------------------
  const sanitized = tenant.name
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${sanitized || 'Responses'}_Responses_${date}.xlsx`;

  return { buffer, filename, responseCount: responses.length };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Pick the scanner version ID to use for column generation.
 *
 * If all responses reference the same version, that one is used.
 * If multiple versions exist (e.g. across a version upgrade boundary),
 * the most common one is preferred.
 */
function resolveScannerVersionId(responses: RawResponseDocument[]): string {
  const counts = new Map<string, number>();

  for (const doc of responses) {
    counts.set(doc.scannerVersionId, (counts.get(doc.scannerVersionId) ?? 0) + 1);
  }

  // Return the version ID with the highest count
  let bestId = '';
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }

  return bestId;
}

/**
 * Build a flattened map of answerId → human-readable answer label.
 *
 * Example: { "opt_01": "Strongly Agree", "opt_02": "Agree", ... }
 *
 * The runtime scanner version stores labels as plain strings (not LocalizedText).
 */
function buildAnswerLabelMap(version: RuntimeScannerVersion): Record<string, string> {
  const map: Record<string, string> = {};

  for (const category of version.categories) {
    for (const subdomain of category.subdomains) {
      for (const question of subdomain.questions) {
        for (const answer of question.answers) {
          map[answer.id] = answer.label;
        }
      }
    }
  }

  return map;
}

/**
 * Build column definitions from the published scanner version's question
 * hierarchy.
 *
 * Order: category.order → subdomain.order → question.order
 * Header: English question text (follow-up questions annotated).
 */
function buildColumns(version: RuntimeScannerVersion): ColumnDefinition[] {
  const columns: ColumnDefinition[] = [];

  // Sort using explicit numeric order fields
  const sortedCategories = [...version.categories].sort((a, b) => a.order - b.order);

  for (const category of sortedCategories) {
    const sortedSubdomains = [...category.subdomains].sort((a, b) => a.order - b.order);

    for (const subdomain of sortedSubdomains) {
      const sortedQuestions = [...subdomain.questions].sort((a, b) => a.order - b.order);

      for (const question of sortedQuestions) {
        const text = question.questionText || `Question ${question.id}`;
        const header = question.kind === 'follow-up' ? `${text} [Follow-up]` : text;

        columns.push({ key: question.id, header });
      }
    }
  }

  return columns;
}

/**
 * Build an array of row objects from the raw response documents.
 *
 * Each row contains:
 *   - submissionId, submittedAt (Group A)
 *   - demographic attribute values (Group B)
 *   - answer labels keyed by questionId (Group C)
 */
function buildRows(
  responses: RawResponseDocument[],
  columns: ColumnDefinition[],
  answerLabels: Record<string, string>,
): ExportRow[] {
  return responses.map((doc) => {
    // Quick lookup: questionId → response row for this submission
    const answerMap = new Map<string, RawResponseDocument['responses'][number]>();
    for (const response of doc.responses) {
      answerMap.set(response.questionId, response);
    }

    // Build the row
    const row: ExportRow = {
      submissionId: doc.submissionId,
      submittedAt: formatDate(doc.submittedAt),
    };

    // Demographic attributes
    for (const key of ATTRIBUTE_KEYS) {
      const value = doc.attributes?.[key];
      row[key] = value && value.trim() ? value : null;
    }

    // Answer labels for each question column
    for (const col of columns) {
      const responseRow = answerMap.get(col.key);
      if (responseRow) {
        row[col.key] = answerLabels[responseRow.answerId] ?? null;
      }
      // If no matching response row, cell remains null (blank)
    }

    return row;
  });
}

/**
 * Format an ISO date string to a readable local datetime string.
 *
 * The reporting team gets "May 10, 2026, 9:30 AM" — readable
 * and locale-independent within English-speaking teams.
 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
