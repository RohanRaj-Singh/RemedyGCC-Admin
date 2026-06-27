/**
 * Response Export Service
 *
 * Orchestrates the end-to-end export workflow and builds a business-ready
 * workbook that a non-technical reporting team can immediately use.
 *
 * Layout:
 *   Sheet 1 — Responses  (identity → demographics → scores → answers)
 *   Sheet 2 — Reference  (survey info, category structure, answer scale)
 */

import 'server-only';

import { getTenantById } from '@/modules/tenant/service';
import {
  getCompletedResponsesForTenant,
  getRuntimeConfigById,
} from '@/server/response/repository';
import type { RawResponseDocument } from '@/server/response/repository';
import type { RuntimeScannerVersion } from '@/types/runtime-config';
import { createWorkbook } from '@/lib/excel/workbook-generator';
import type { ColumnDefinition, ExportRow } from '@/lib/excel/workbook-generator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATTRIBUTE_KEYS = ['stream', 'location', 'function', 'department', 'gender', 'age', 'seniority'] as const;

const ATTRIBUTE_LABELS: Record<string, string> = {
  stream: 'Stream',
  location: 'Location',
  function: 'Function',
  department: 'Department',
  gender: 'Gender',
  age: 'Age Group',
  seniority: 'Seniority',
};

// How many columns to freeze (identity + demographics)
const FROZEN_COLUMN_COUNT = 10;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  responseCount: number;
}

export async function generateResponseExport(tenantId: string): Promise<ExportResult> {
  // ---- Step 1: Resolve tenant -------------------------------------------
  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error('Tenant not found.');

  // ---- Step 2: Read completed responses ---------------------------------
  const responses = await getCompletedResponsesForTenant(tenantId);
  if (responses.length === 0) {
    throw new Error('No completed survey responses found for this tenant.');
  }

  // ---- Step 3: Resolve runtime config (embedded scanner version) ---------
  const runtimeConfigId = resolveRuntimeConfigId(responses);
  const rawConfig = await getRuntimeConfigById(runtimeConfigId);
  if (!rawConfig) {
    throw new Error(
      'The survey configuration for these responses could not be found. ' +
      'Please ensure the survey has been published and try again.',
    );
  }

  const scannerVersion = rawConfig.scannerVersion as unknown as RuntimeScannerVersion;

  // ---- Step 4: Build structures from scanner version --------------------
  const { questionCols, categoryCols, answerScale } = buildColumnDefs(scannerVersion);
  const answerLabels = buildAnswerLabelMap(scannerVersion);
  const categoryQuestionIds = buildCategoryQuestionMap(scannerVersion);

  // Combined columns: Identity → Demographics → Category Scores → Questions
  const allColumns: ColumnDefinition[] = [
    ...identityColumns,
    ...demographicColumns,
    ...categoryCols,
    ...questionCols,
  ];

  // ---- Step 5: Build rows ------------------------------------------------
  const rows = buildRows(responses, categoryCols, questionCols, answerLabels, categoryQuestionIds);

  // ---- Step 6: Build Reference sheet -------------------------------------
  const refRows = buildReferenceRows(tenant.name, responses.length, questionCols.length, scannerVersion, answerScale);

  // ---- Step 7: Generate workbook -----------------------------------------
  const buffer = createWorkbook(
    {
      name: 'Responses',
      columns: allColumns,
      rows,
      options: {
        wrapHeaders: true,
        themed: true,
        autoFilter: true,
        freezePane: { xSplit: FROZEN_COLUMN_COUNT, ySplit: 1 },
      },
    },
    {
      name: 'Reference',
      columns: refColumns,
      rows: refRows,
      options: { autoFilter: false, freezePane: false, themed: true },
    },
  );

  // ---- Step 8: Build filename -------------------------------------------
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
// Column definitions
// ---------------------------------------------------------------------------

const identityColumns: ColumnDefinition[] = [
  { key: '_row', header: '#', width: 6 },
  { key: 'responseId', header: 'Response ID', width: 16 },
  { key: 'submittedAt', header: 'Submitted At', width: 20 },
];

const demographicColumns: ColumnDefinition[] = ATTRIBUTE_KEYS.map((key) => ({
  key,
  header: ATTRIBUTE_LABELS[key],
  width: 18,
}));

const refColumns: ColumnDefinition[] = [
  { key: 'section', header: 'Section', width: 25 },
  { key: 'field', header: 'Field', width: 30 },
  { key: 'value', header: 'Value', width: 60 },
];

// ---------------------------------------------------------------------------
// Build helpers
// ---------------------------------------------------------------------------

function resolveRuntimeConfigId(responses: RawResponseDocument[]): string {
  const counts = new Map<string, number>();
  for (const doc of responses) {
    const id = doc.runtimeConfigId;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let bestId = '';
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) { bestId = id; bestCount = count; }
  }
  return bestId;
}

/**
 * Build column definitions from the scanner version.
 *
 * Returns:
 *   - questionCols: one per question, sorted by hierarchy, with category-prefixed headers
 *   - categoryCols: one per category for computed average score
 *   - answerScale: the answer scale mapping for the Reference sheet
 */
function buildColumnDefs(version: RuntimeScannerVersion): {
  questionCols: ColumnDefinition[];
  categoryCols: ColumnDefinition[];
  answerScale: { value: string; label: string }[];
} {
  const questionCols: ColumnDefinition[] = [];
  let answerScale: { value: string; label: string }[] = [];
  let scaleCaptured = false;

  const sortedCategories = [...version.categories].sort((a, b) => a.order - b.order);

  for (const category of sortedCategories) {
    const sortedSubdomains = [...category.subdomains].sort((a, b) => a.order - b.order);
    for (const subdomain of sortedSubdomains) {
      const sortedQuestions = [...subdomain.questions].sort((a, b) => a.order - b.order);
      for (const question of sortedQuestions) {
        const header = question.kind === 'follow-up'
          ? `${category.label} / ${question.questionText} [Follow-up]`
          : `${category.label} / ${question.questionText}`;
        questionCols.push({ key: question.id, header });

        if (!scaleCaptured && question.answers.length > 0) {
          answerScale = [...question.answers]
            .sort((a, b) => a.order - b.order)
            .map((a) => ({ value: a.label, label: `${a.score} → ${a.label}` }));
          scaleCaptured = true;
        }
      }
    }
  }

  const categoryCols: ColumnDefinition[] = sortedCategories.map((cat) => ({
    key: `_score_${cat.id}`,
    header: `${cat.label} Score`,
    width: 24,
  }));

  return { questionCols, categoryCols, answerScale };
}

/**
 * Build answerId → answer label lookup map.
 */
function buildAnswerLabelMap(version: RuntimeScannerVersion): Record<string, string> {
  const map: Record<string, string> = {};
  for (const cat of version.categories) {
    for (const sub of cat.subdomains) {
      for (const q of sub.questions) {
        for (const ans of q.answers) {
          map[ans.id] = ans.label;
        }
      }
    }
  }
  return map;
}

/**
 * Build categoryId → primary questionIds[] map.
 */
function buildCategoryQuestionMap(version: RuntimeScannerVersion): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const cat of version.categories) {
    const ids: string[] = [];
    for (const sub of cat.subdomains) {
      for (const q of sub.questions) {
        if (q.kind === 'primary') {
          ids.push(q.id);
        }
      }
    }
    map.set(cat.id, ids);
  }
  return map;
}

/**
 * Build row objects from response documents.
 *
 * Each row:
 *   # | Response ID | Submitted At | Stream | ... | Category Scores | ... | Answer labels
 */
function buildRows(
  responses: RawResponseDocument[],
  categoryCols: ColumnDefinition[],
  questionCols: ColumnDefinition[],
  answerLabels: Record<string, string>,
  categoryQuestionIds: Map<string, string[]>,
): ExportRow[] {
  return responses.map((doc, index) => {
    // Build answerScore lookup for this submission
    const scoreMap = new Map<string, number>();
    const answerIdMap = new Map<string, string>();
    for (const resp of doc.responses) {
      scoreMap.set(resp.questionId, resp.answerScore);
      answerIdMap.set(resp.questionId, resp.answerId);
    }

    const row: ExportRow = {
      _row: index + 1,
      responseId: shortId(doc.submissionId),
      submittedAt: formatDateTime(doc.submittedAt),
    };

    // Demographics — support both individual keys and combined-value formats
    const attrValues = extractAttributes(doc.attributes);
    for (const key of ATTRIBUTE_KEYS) {
      row[key] = attrValues[key] ?? null;
    }

    // Category scores: average answerScore of primary questions per category
    for (const col of categoryCols) {
      const catId = col.key.replace('_score_', '');
      const questionIds = categoryQuestionIds.get(catId);
      if (questionIds && questionIds.length > 0) {
        const scores: number[] = [];
        for (const qId of questionIds) {
          const score = scoreMap.get(qId);
          if (score !== undefined) {
            scores.push(score);
          }
        }
        if (scores.length > 0) {
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          row[col.key] = Math.round(avg * 100) / 100;
        }
      }
    }

    // Question answers (human-readable labels)
    for (const col of questionCols) {
      const answerId = answerIdMap.get(col.key);
      if (answerId) {
        row[col.key] = answerLabels[answerId] ?? null;
      }
    }

    return row;
  });
}

/**
 * Extract individual demographic attribute values from a response document.
 *
 * Handles multiple storage formats:
 *   A. Individual keys:  { stream: "clinical_services", location: "central_campus", ... }
 *   B. Numbered keys:    { "0": "clinical_services", "1": "central_campus", ... }
 *   C. Combined values:  { stream: "clinical_services-central_campus-...", location: "same" }
 *   D. Flat string:      attributes field itself is a delimited string
 *
 * Returns a map of ATTRIBUTE_KEYS → value (or null if not found).
 */
function extractAttributes(
  attributes: Record<string, string> | undefined | null,
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const key of ATTRIBUTE_KEYS) {
    result[key] = null;
  }

  if (!attributes || typeof attributes !== 'object') {
    return result;
  }

  // --- Strategy A: Individual keys exist and have unique values ---
  let allHaveValues = true;
  const values = new Set<string>();
  for (const key of ATTRIBUTE_KEYS) {
    const val = attributes[key];
    if (val && typeof val === 'string' && val.trim()) {
      values.add(val.trim());
      result[key] = val.trim();
    } else {
      allHaveValues = false;
    }
  }

  // If every key has a value and they're NOT all identical, we're done
  if (allHaveValues && values.size > 1) {
    return result;
  }

  // If all values are identical AND contain dashes, they might be combined
  if (allHaveValues && values.size === 1) {
    const combined = [...values][0];
    if (combined.includes('-')) {
      // Try splitting by dash — matches the pattern "clinical_services-central_campus-..."
      const parts = combined.split('-');
      if (parts.length >= ATTRIBUTE_KEYS.length) {
        for (let i = 0; i < ATTRIBUTE_KEYS.length; i++) {
          result[ATTRIBUTE_KEYS[i]] = parts[i].trim() || null;
        }
        return result;
      }
    }
  }

  // --- Strategy B: Numbered keys ---
  if (attributes['0']) {
    let allNumbered = true;
    const vals: string[] = [];
    for (let i = 0; i < ATTRIBUTE_KEYS.length; i++) {
      const val = attributes[String(i)];
      if (val && typeof val === 'string' && val.trim()) {
        vals.push(val.trim());
      } else {
        allNumbered = false;
        break;
      }
    }
    if (allNumbered && vals.length > 0) {
      for (let i = 0; i < Math.min(vals.length, ATTRIBUTE_KEYS.length); i++) {
        result[ATTRIBUTE_KEYS[i]] = vals[i];
      }
      return result;
    }
  }

  // --- Strategy C: Fall back to raw values (already set above from strategy A) ---
  return result;
}

/**
 * Build Reference sheet rows.
 *
 * Sections:
 *   1. Survey Information
 *   2. Category Structure (categories and their subdomains)
 *   3. Answer Scale
 */
function buildReferenceRows(
  tenantName: string,
  responseCount: number,
  questionCount: number,
  scannerVersion: RuntimeScannerVersion,
  answerScale: { value: string; label: string }[],
): ExportRow[] {
  const rows: ExportRow[] = [];

  // Section 1: Survey Information
  rows.push({ section: 'Survey Information', field: '', value: '' });
  rows.push({ section: '', field: 'Survey Name', value: 'Occupational Qualification and Experience Profile (OQEP)' });
  rows.push({ section: '', field: 'Tenant Name', value: tenantName });
  rows.push({ section: '', field: 'Export Date', value: formatDateTime(new Date().toISOString()) });
  rows.push({ section: '', field: 'Total Responses', value: responseCount });
  rows.push({ section: '', field: 'Total Questions', value: questionCount });
  rows.push({ section: '', field: '', value: '' });

  // Section 2: Category Structure
  rows.push({ section: 'Category Structure', field: '', value: '' });
  rows.push({ section: '', field: 'Category', value: 'Subdomains (Questions)' });

  const sortedCats = [...scannerVersion.categories].sort((a, b) => a.order - b.order);
  for (const cat of sortedCats) {
    const parts: string[] = [];
    for (const sub of [...cat.subdomains].sort((a, b) => a.order - b.order)) {
      const qCount = sub.questions.filter((q) => q.kind === 'primary').length;
      parts.push(`${sub.label} (${qCount} questions)`);
    }
    rows.push({ section: '', field: cat.label, value: parts.join('; ') });
  }
  rows.push({ section: '', field: '', value: '' });

  // Section 3: Answer Scale
  rows.push({ section: 'Answer Scale', field: '', value: '' });
  rows.push({ section: '', field: 'Answer', value: 'Meaning' });
  if (answerScale.length > 0) {
    for (const scale of answerScale) {
      rows.push({ section: '', field: scale.label, value: '' });
    }
  } else {
    rows.push({ section: '', field: '', value: 'No answer scale data available.' });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Short human-readable ID from the last 8 chars of the submission ID */
function shortId(submissionId: string): string {
  if (!submissionId) return '—';
  return submissionId.length > 8 ? submissionId.slice(-8) : submissionId;
}

/** Format ISO date to readable string */
function formatDateTime(iso: string): string {
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
