import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billingEligibility,
  billingEligibilityMeta,
  isEligibleForInvoicing,
  type ClaimInvoiceLink,
} from '../eligibility';

const noLink: ClaimInvoiceLink = { invoiceId: null, invoiceNumber: null, invoiceStatus: null };

function link(status: string): ClaimInvoiceLink {
  return { invoiceId: 'inv_1', invoiceNumber: 'INV-1', invoiceStatus: status };
}

describe('isEligibleForInvoicing', () => {
  it('is true for an approved claim not on any invoice', () => {
    assert.equal(isEligibleForInvoicing('approved', noLink), true);
  });

  it('is false for an approved claim already on an invoice', () => {
    assert.equal(isEligibleForInvoicing('approved', link('draft')), false);
  });

  it('is false for every non-approved status', () => {
    for (const status of ['pending', 'in_progress', 'to_be_paid', 'rejected', 'frozen', 'paid'] as const) {
      assert.equal(isEligibleForInvoicing(status, noLink), false, status);
    }
  });
});

describe('billingEligibility', () => {
  it('maps paid → paid (terminal)', () => {
    assert.equal(billingEligibility('paid', noLink), 'paid');
  });

  it('maps to_be_paid → ready_for_payout', () => {
    assert.equal(billingEligibility('to_be_paid', noLink), 'ready_for_payout');
  });

  it('maps approved without invoice → ready_for_invoicing', () => {
    assert.equal(billingEligibility('approved', noLink), 'ready_for_invoicing');
  });

  it('maps an approved claim on a draft invoice → invoiced_draft', () => {
    assert.equal(billingEligibility('approved', link('draft')), 'invoiced_draft');
  });

  it('maps an approved claim on an issued invoice → invoiced_issued', () => {
    assert.equal(billingEligibility('approved', link('issued')), 'invoiced_issued');
  });

  it('maps an approved claim on a paid invoice → invoiced_paid', () => {
    assert.equal(billingEligibility('approved', link('paid')), 'invoiced_paid');
  });

  it('maps an approved claim on an archived invoice → invoiced_archived', () => {
    assert.equal(billingEligibility('approved', link('archived')), 'invoiced_archived');
  });

  it('defaults unknown invoice statuses on approved claims to invoiced_draft', () => {
    assert.equal(billingEligibility('approved', link('weird')), 'invoiced_draft');
  });

  it('maps every other status → not_eligible', () => {
    for (const status of ['pending', 'in_progress', 'rejected', 'frozen'] as const) {
      assert.equal(billingEligibility(status, noLink), 'not_eligible', status);
    }
  });
});

describe('billingEligibilityMeta', () => {
  it('only ready_for_invoicing is selectable', () => {
    const selectable = billingEligibilityMeta('approved', noLink);
    assert.equal(selectable.key, 'ready_for_invoicing');
    assert.equal(selectable.selectable, true);
    assert.equal(selectable.label, 'Ready for billing');

    const invoiced = billingEligibilityMeta('approved', link('issued'));
    assert.equal(invoiced.key, 'invoiced_issued');
    assert.equal(invoiced.selectable, false);
    assert.equal(invoiced.label, 'Awaiting organization payment');
  });

  it('attaches a human label and description to every key', () => {
    for (const status of ['pending', 'approved', 'to_be_paid', 'paid', 'rejected'] as const) {
      const meta = billingEligibilityMeta(status, noLink);
      assert.ok(meta.label.length > 0);
      assert.ok(meta.description.length > 0);
    }
  });
});
