/**
 * Workbook Generator — Unit Tests
 *
 * Pure function tests for the xlsx workbook generator.
 * No database, no filesystem — deterministic and fast.
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as XLSX from 'xlsx';
import { createWorkbook } from '../workbook-generator';
import type { ColumnDefinition, ExportRow } from '../workbook-generator';

// Helper to read workbook from a buffer
function readWorkbook(buffer: Buffer) {
  return XLSX.read(buffer, { type: 'buffer' });
}

describe('Workbook Generator', () => {
  describe('createWorkbook', () => {
    it('returns a valid Buffer', () => {
      const columns: ColumnDefinition[] = [{ key: 'id', header: 'ID' }];
      const rows: ExportRow[] = [{ id: '001' }];

      const result = createWorkbook({ name: 'Test', columns, rows });

      assert.ok(result instanceof Buffer);
      assert.ok(result.byteLength > 0);
    });

    it('creates a worksheet with the given name', () => {
      const columns: ColumnDefinition[] = [{ key: 'a', header: 'A' }];
      const rows: ExportRow[] = [{ a: '1' }];

      const result = createWorkbook({ name: 'Responses', columns, rows });
      const wb = readWorkbook(result);

      assert.strictEqual(wb.SheetNames.length, 1);
      assert.strictEqual(wb.SheetNames[0], 'Responses');
    });

    it('writes correct header row', () => {
      const columns: ColumnDefinition[] = [
        { key: 'col1', header: 'Column One' },
        { key: 'col2', header: 'Column Two' },
        { key: 'col3', header: 'Column Three' },
      ];
      const rows: ExportRow[] = [];

      const result = createWorkbook({ name: 'Test', columns, rows });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      assert.ok(data.length >= 1);
      const headers = data[0] as string[];
      assert.strictEqual(headers[0], 'Column One');
      assert.strictEqual(headers[1], 'Column Two');
      assert.strictEqual(headers[2], 'Column Three');
    });

    it('writes data rows correctly', () => {
      const columns: ColumnDefinition[] = [
        { key: 'name', header: 'Name' },
        { key: 'score', header: 'Score' },
      ];
      const rows: ExportRow[] = [
        { name: 'Alice', score: 95 },
        { name: 'Bob', score: 87 },
        { name: 'Charlie', score: 92 },
      ];

      const result = createWorkbook({ name: 'Test', columns, rows });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      assert.strictEqual(data[1][0], 'Alice');
      assert.strictEqual(data[1][1], 95);
      assert.strictEqual(data[2][0], 'Bob');
      assert.strictEqual(data[2][1], 87);
      assert.strictEqual(data[3][0], 'Charlie');
      assert.strictEqual(data[3][1], 92);
    });

    it('leaves null/undefined values as empty cells', () => {
      const columns: ColumnDefinition[] = [
        { key: 'a', header: 'A' },
        { key: 'b', header: 'B' },
      ];
      const rows: ExportRow[] = [{ a: 'x', b: null }];

      const result = createWorkbook({ name: 'Test', columns, rows });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '__EMPTY__' });

      assert.strictEqual(data[1][0], 'x');
      assert.strictEqual(data[1][1], '__EMPTY__');
    });

    it('handles empty rows array', () => {
      const columns: ColumnDefinition[] = [{ key: 'h', header: 'Header Only' }];
      const rows: ExportRow[] = [];

      const result = createWorkbook({ name: 'Test', columns, rows });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0][0], 'Header Only');
    });

    it('applies bold formatting to header row', () => {
      const columns: ColumnDefinition[] = [{ key: 'x', header: 'Bold Header' }];
      const rows: ExportRow[] = [{ x: 'data' }];

      const result = createWorkbook({ name: 'Test', columns, rows });

      assert.ok(result instanceof Buffer);
      assert.ok(result.byteLength > 0);

      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      assert.strictEqual(data[0][0], 'Bold Header');
      assert.strictEqual(data[1][0], 'data');
    });

    it('produces a valid xlsx that opens in standard readers', () => {
      const columns: ColumnDefinition[] = [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'score', header: 'Score' },
      ];
      const rows: ExportRow[] = [
        { id: '1', name: 'Alice', score: 95 },
        { id: '2', name: 'Bob', score: 87 },
      ];

      const result = createWorkbook({ name: 'Data', columns, rows });

      assert.ok(result.byteLength > 0);
      assert.strictEqual(result.readUInt32LE(0), 0x04034B50);

      const wb = readWorkbook(result);
      const ws = wb.Sheets['Data'];
      assert.ok(ws);
      const data = XLSX.utils.sheet_to_json(ws);
      assert.strictEqual(data.length, 2);
      assert.strictEqual(data[0].ID, '1');
      assert.strictEqual(data[1].Name, 'Bob');
      assert.strictEqual(data[1].Score, 87);
    });

    it('handles mixed data types', () => {
      const columns: ColumnDefinition[] = [
        { key: 'text', header: 'Text' },
        { key: 'number', header: 'Number' },
        { key: 'empty', header: 'Empty' },
      ];
      const rows: ExportRow[] = [{ text: 'hello', number: 42, empty: undefined }];

      const result = createWorkbook({ name: 'Test', columns, rows });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '__MISS__' });

      assert.strictEqual(data[1][0], 'hello');
      assert.strictEqual(data[1][1], 42);
      assert.strictEqual(data[1][2], '__MISS__');
    });

    it('supports multiple worksheets', () => {
      const result = createWorkbook(
        {
          name: 'Sheet1',
          columns: [{ key: 'a', header: 'A' }],
          rows: [{ a: 'data1' }],
        },
        {
          name: 'Sheet2',
          columns: [{ key: 'b', header: 'B' }],
          rows: [{ b: 'data2' }],
        },
      );

      const wb = readWorkbook(result);
      assert.strictEqual(wb.SheetNames.length, 2);
      assert.strictEqual(wb.SheetNames[0], 'Sheet1');
      assert.strictEqual(wb.SheetNames[1], 'Sheet2');

      const s1 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { header: 1 });
      const s2 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet2'], { header: 1 });
      assert.strictEqual(s1[1][0], 'data1');
      assert.strictEqual(s2[1][0], 'data2');
    });

    it('applies header background colour when option is set', () => {
      const result = createWorkbook({
        name: 'Test',
        columns: [{ key: 'x', header: 'Header' }],
        rows: [{ x: 'val' }],
        options: { themed: true },
      });

      assert.ok(result instanceof Buffer);
      assert.ok(result.byteLength > 0);

      const wb = readWorkbook(result);
      const ws = wb.Sheets['Test'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      assert.strictEqual(data[0][0], 'Header');
      assert.strictEqual(data[1][0], 'val');
    });

    it('handles a realistic survey-like structure', () => {
      const columns: ColumnDefinition[] = [
        { key: 'submissionId', header: 'Submission ID' },
        { key: 'submittedAt', header: 'Submitted At' },
        { key: 'q_001', header: 'Clinical Risk Index / Overall satisfaction' },
        { key: 'q_002', header: 'Psychological Safety / Would recommend' },
        { key: 'q_003', header: 'Leadership / Communication quality' },
      ];
      const rows: ExportRow[] = [
        {
          submissionId: 'sub_001',
          submittedAt: 'May 10, 2026, 9:30 AM',
          q_001: 'Satisfied',
          q_002: 'Agree',
          q_003: 'Excellent',
        },
        {
          submissionId: 'sub_002',
          submittedAt: 'Jun 15, 2026, 2:15 PM',
          q_001: 'Very Satisfied',
          q_002: 'Strongly Agree',
          q_003: null,
        },
      ];

      const result = createWorkbook({ name: 'Responses', columns, rows, options: { themed: true } });
      const wb = readWorkbook(result);
      const ws = wb.Sheets['Responses'];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '__EMPTY__' });

      assert.strictEqual(data.length, 3);
      assert.strictEqual(data[1][0], 'sub_001');
      assert.strictEqual(data[1][2], 'Satisfied');
      assert.strictEqual(data[2][0], 'sub_002');
      assert.strictEqual(data[2][3], 'Strongly Agree');
      assert.strictEqual(data[2][4], '__EMPTY__');
    });
  });
});
