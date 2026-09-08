import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCurrency, formatDate } from '../format';

describe('formatCurrency', () => {
  it('renders OMR with 2 decimal places', () => {
    assert.equal(formatCurrency(100), 'OMR 100.00');
    assert.equal(formatCurrency(25.5), 'OMR 25.50');
    assert.equal(formatCurrency(0), 'OMR 0.00');
  });

  it('groups thousands for large amounts', () => {
    assert.equal(formatCurrency(12450), 'OMR 12,450.00');
    assert.equal(formatCurrency(1234567.8), 'OMR 1,234,567.80');
  });
});

describe('formatDate', () => {
  it('renders an em dash for null/undefined/empty', () => {
    assert.equal(formatDate(null), '—');
    assert.equal(formatDate(undefined), '—');
    assert.equal(formatDate(''), '—');
  });

  it('returns the input unchanged for an unparseable value', () => {
    assert.equal(formatDate('not-a-date'), 'not-a-date');
  });

  it('formats a valid ISO date', () => {
    const out = formatDate('2026-08-26T10:00:00.000Z');
    assert.ok(out.includes('2026'));
    assert.notEqual(out, '—');
  });
});
