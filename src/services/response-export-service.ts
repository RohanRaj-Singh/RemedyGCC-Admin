/**
 * Response Export Service
 *
 * Simplified implementation that derives column structure entirely from
 * response data — no scanner version lookup required.
 *
 * Column headers = questionId values found across all completed responses.
 * Cell values   = answerScore (the raw numeric score).
 *
 * This eliminates all cross-collection dependencies. If a scanner version
 * lookup is needed later for answer labels or question text, it can be
 * added as an optional enrichment step.
 */

import 'server-only';

import { getTenantById } from '@/modules/tenant/service';
import { getCompletedResponsesForTenant } from '@/server/response/repository';
import type { RawResponseDocument } from '@/server/response/repository';
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
  buffer: Buffer;
  filename: string;
  responseCount: number;
}

/**
 * Generate an xlsx export of completed survey responses for a tenant.
 *
 * Derives question columns from the response data itself — no external
 * scanner version dependency. Every unique questionId across all completed
 * submissions becomes a column, sorted by first-encountered order.
 *
 * Cell values are the raw answerScore (numeric).
 * Missing / unanswered questions leave the cell blank.
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

  // ---- Step 3: Derive columns from response data ------------------------
  const columns = deriveColumns(responses);
  const rows = buildRows(responses, columns);

  // ---- Step 4: Generate workbook ----------------------------------------
  const buffer = createWorkbook('Responses', columns, rows);

  // ---- Step 5: Build filename -------------------------------------------
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
 * Derive column definitions from the response data alone.
 *
 * Scans every response row across all submissions to discover the unique
 * set of question IDs. Columns are ordered by first occurrence to maintain
 * a consistent layout.
 *
 * @param responses - All completed response documents
 * @returns Column definitions keyed by questionId
 */
function deriveColumns(responses: RawResponseDocument[]): ColumnDefinition[] {
  const seen = new Set<string>();
  const columns: ColumnDefinition[] = [];

  for (const doc of responses) {
    for (const response of doc.responses) {
      if (response.questionKind === 'follow-up') continue;
      if (!seen.has(response.questionId)) {
        seen.add(response.questionId);
        columns.push({ key: response.questionId, header: response.questionId });
      }
    }
  }

  // If no primary questions found, include follow-ups as a fallback
  if (columns.length === 0) {
    for (const doc of responses) {
      for (const response of doc.responses) {
        if (!seen.has(response.questionId)) {
          seen.add(response.questionId);
          const header = response.questionKind === 'follow-up'
            ? `${response.questionId} [Follow-up]`
            : response.questionId;
          columns.push({ key: response.questionId, header });
        }
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
 *   - answerScore keyed by questionId (Group C)
 *
 * Unanswered questions are left blank.
 */
function buildRows(
  responses: RawResponseDocument[],
  columns: ColumnDefinition[],
): ExportRow[] {
  return responses.map((doc) => {
    // Quick lookup: questionId → answerScore for this submission
    const scoreMap = new Map<string, number>();
    for (const response of doc.responses) {
      scoreMap.set(response.questionId, response.answerScore);
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

    // Answer scores for each question column
    for (const col of columns) {
      const score = scoreMap.get(col.key);
      if (score !== undefined) {
        row[col.key] = score;
      }
      // If no match, cell remains null (blank)
    }

    return row;
  });
}

/**
 * Format an ISO date string to a readable local datetime string.
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
