/**
 * Workbook Generator
 *
 * Pure function: takes structured sheet definitions and returns a Node.js
 * Buffer containing an .xlsx workbook.
 *
 * No side effects, no database access, no state management.
 */

import * as XLSX from 'xlsx';

export interface ColumnDefinition {
  /** Unique key used to look up values in a row object */
  key: string;
  /** Human-readable header text shown in the spreadsheet */
  header: string;
  /** Optional column width in characters (auto-calculated if omitted) */
  width?: number;
}

export interface ExportRow {
  [key: string]: string | number | null | undefined;
}

export interface SheetDefinition {
  /** Worksheet name (max 31 chars for Excel compatibility) */
  name: string;
  /** Ordered column definitions */
  columns: ColumnDefinition[];
  /** Row data */
  rows: ExportRow[];
  /** Optional formatting overrides for this sheet */
  options?: {
    /** Whether to enable auto-filter on the header row (default: true) */
    autoFilter?: boolean;
    /** Whether to wrap text in header cells (default: false) */
    wrapHeaders?: boolean;
    /** Whether to apply a themed header style (default: false) */
    themed?: boolean;
    /** Whether to freeze rows/columns. Set xSplit to freeze N leftmost columns (default: freeze row 1) */
    freezePane?: boolean | { xSplit?: number; ySplit?: number };
  };
}

// ---------------------------------------------------------------------------
// Colour palette
// ---------------------------------------------------------------------------

const HEADER_BG = 'FF1F4E79';       // Dark blue header
const HEADER_FONT = 'FFFFFFFF';      // White text
const BORDER_COLOR = 'FFB0B0B0';    // Light gray border
const STRIPE_EVEN = 'FFF2F7FB';     // Very light blue for alternating rows
const STRIPE_ODD = 'FFFFFFFF';       // White for base rows

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create an .xlsx workbook from one or more sheet definitions.
 */
export function createWorkbook(...sheets: SheetDefinition[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = buildWorksheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buffer);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function makeBorder(style: string): any {
  const line = { style, color: { rgb: BORDER_COLOR } };
  return { top: line, bottom: line, left: line, right: line };
}

const THIN_BORDER = makeBorder('thin');

function buildWorksheet(sheet: SheetDefinition): XLSX.WorkSheet {
  const { columns, rows, options } = sheet;
  const autoFilter = options?.autoFilter ?? true;
  const wrapHeaders = options?.wrapHeaders ?? false;
  const themed = options?.themed ?? false;
  const freezePane = options?.freezePane ?? true;

  // --- Build 2D array ---
  const headers = columns.map((col) => col.header);
  const data: unknown[][] = [headers];
  for (const row of rows) {
    data.push(columns.map((col) => row[col.key] ?? null));
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // --- Column widths ---
  ws['!cols'] = columns.map((col) => {
    if (col.width) return { wch: col.width };
    let w = col.header.length + 4;
    for (const row of rows) {
      const v = row[col.key];
      if (v != null) w = Math.max(w, String(v).length + 2);
    }
    return { wch: Math.max(10, Math.min(70, w)) };
  });

  // --- Cell formatting ---
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      const isHeader = r === 0;

      if (isHeader && themed) {
        // Dark blue header with white bold text
        (cell.s as any) = {
          font: { bold: true, color: { rgb: HEADER_FONT }, sz: 11, name: 'Calibri' },
          fill: { fgColor: { rgb: HEADER_BG } },
          border: THIN_BORDER,
        };
      } else if (isHeader) {
        (cell.s as any) = {
          font: { bold: true, sz: 11, name: 'Calibri' },
          border: THIN_BORDER,
        };
      } else if (themed) {
        // Alternating row colours + border
        const isEven = r % 2 === 0;
        (cell.s as any) = {
          font: { sz: 10, name: 'Calibri' },
          fill: { fgColor: { rgb: isEven ? STRIPE_EVEN : STRIPE_ODD } },
          border: THIN_BORDER,
        };
      } else {
        (cell.s as any) = {
          font: { sz: 10, name: 'Calibri' },
          border: THIN_BORDER,
        };
      }
    }
  }

  // --- Freeze pane ---
  if (freezePane) {
    if (typeof freezePane === 'object') {
      ws['!freeze'] = { xSplit: freezePane.xSplit ?? 0, ySplit: freezePane.ySplit ?? 1 };
    } else {
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    }
  }

  // --- Auto-filter ---
  if (autoFilter && rows.length > 0) {
    const lastCol = XLSX.utils.encode_col(columns.length - 1);
    const lastRow = XLSX.utils.encode_row(rows.length);
    ws['!autofilter'] = { ref: `A1:${lastCol}${lastRow}` };
  }

  return ws;
}
