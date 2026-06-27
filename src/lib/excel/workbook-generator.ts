/**
 * Workbook Generator
 *
 * Pure function: takes structured column definitions and row data,
 * returns a Node.js Buffer containing an .xlsx workbook.
 *
 * No side effects, no database access, no state management.
 * Easy to test in isolation.
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

/**
 * Create an .xlsx workbook from column definitions and export rows.
 *
 * @param sheetName - Name of the worksheet (default: "Responses")
 * @param columns - Ordered column definitions
 * @param rows - Array of row objects keyed by column.key
 * @returns Node.js Buffer containing the .xlsx file
 */
export function createWorkbook(
  sheetName: string,
  columns: ColumnDefinition[],
  rows: ExportRow[],
): Buffer {
  // Build the 2D array: header row + data rows
  const headers = columns.map((col) => col.header);
  const data: unknown[][] = [headers];

  for (const row of rows) {
    const rowData = columns.map((col) => {
      const value = row[col.key];
      return value ?? null; // null = empty cell in xlsx
    });
    data.push(rowData);
  }

  // Create worksheet from the 2D array
  const ws = XLSX.utils.aoa_to_sheet(data);

  // --- Formatting ---

  // Calculate column widths (header-based with padding, or use explicit width)
  const colWidths = columns.map((col, index) => {
    if (col.width) {
      return { wch: col.width };
    }

    // Calculate based on header length (minimum 10, maximum 60)
    const headerLength = col.header.length;
    let width = headerLength + 4; // padding

    // Check data rows for longer content
    for (const row of rows) {
      const value = row[col.key];
      if (value != null) {
        const strLen = String(value).length;
        if (strLen + 2 > width) {
          width = strLen + 2;
        }
      }
    }

    return { wch: Math.max(10, Math.min(60, width)) };
  });
  ws['!cols'] = colWidths;

  // Bold the header row
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1:A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = { font: { bold: true } };
    }
  }

  // Freeze the first row (header)
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  // Create workbook and append the worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Write to buffer
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return Buffer.from(buffer);
}
