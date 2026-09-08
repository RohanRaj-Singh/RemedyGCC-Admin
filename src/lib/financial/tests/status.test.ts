import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABEL,
  CLAIM_STATUS_DISPLAY,
  CLAIM_STATUS_TONE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_DISPLAY,
  INVOICE_STATUS_TONE,
  type ClaimStatus,
  type InvoiceStatus,
} from '../status';

describe('claim status labels', () => {
  it('covers every status in the frozen machine', () => {
    const expected: ClaimStatus[] = [
      'pending',
      'in_progress',
      'approved',
      'to_be_paid',
      'rejected',
      'frozen',
      'paid',
    ];
    for (const status of expected) {
      assert.ok(CLAIM_STATUS_LABEL[status], status);
    }
    assert.deepEqual(CLAIM_STATUSES, expected);
  });
});

describe('invoice status labels', () => {
  it('covers the invoice lifecycle', () => {
    const expected: InvoiceStatus[] = ['draft', 'issued', 'paid', 'archived'];
    for (const status of expected) {
      assert.ok(INVOICE_STATUS_LABEL[status], status);
    }
  });
});

describe('human-facing display labels', () => {
  it('translates claim states into operator language', () => {
    assert.equal(CLAIM_STATUS_DISPLAY.to_be_paid, 'Ready to pay');
    assert.equal(CLAIM_STATUS_DISPLAY.in_progress, 'In review');
    assert.equal(CLAIM_STATUS_DISPLAY.paid, 'Paid');
  });

  it('translates invoice states into operator language', () => {
    assert.equal(INVOICE_STATUS_DISPLAY.issued, 'Awaiting organization payment');
    assert.equal(INVOICE_STATUS_DISPLAY.paid, 'Paid');
  });

  it('maps the terminal paid state to a success tone, never a highlight', () => {
    assert.equal(CLAIM_STATUS_TONE.paid, 'success');
    assert.equal(INVOICE_STATUS_TONE.paid, 'success');
    // No purple anywhere in the tone vocabulary.
    const tones = new Set([
      ...Object.values(CLAIM_STATUS_TONE),
      ...Object.values(INVOICE_STATUS_TONE),
    ]);
    assert.ok(!tones.has('purple' as never));
  });
});
