import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deselectPageInvoices,
  distinctOrgCount,
  planBulkTransition,
  planInvoicePackage,
  selectPageInvoices,
  selectedInvoices,
  sumTotal,
  toggleInvoiceSelection,
} from '../invoiceSelection';
import type { BulkSelectableInvoice } from '../invoiceSelection';

function invoice(
  id: string,
  tenantId: string,
  status: BulkSelectableInvoice['status'],
  totalAmount = 100,
): BulkSelectableInvoice {
  return {
    invoiceId: id,
    invoiceNumber: `INV-${id}`,
    tenantId,
    status,
    totalAmount,
  };
}

describe('toggleInvoiceSelection', () => {
  it('adds and removes an invoice id', () => {
    assert.deepEqual(toggleInvoiceSelection([], 'a'), ['a']);
    assert.deepEqual(toggleInvoiceSelection(['a'], 'a'), []);
  });
});

describe('selectPageInvoices / deselectPageInvoices', () => {
  it('unions page ids without duplicates and keeps off-page selections', () => {
    assert.deepEqual(selectPageInvoices(['a', 'b'], ['b', 'z']), ['b', 'z', 'a']);
  });

  it('removes page ids while keeping off-page selections', () => {
    assert.deepEqual(deselectPageInvoices(['a', 'b'], ['a', 'b', 'z']), ['z']);
  });
});

describe('selectedInvoices / distinctOrgCount / sumTotal', () => {
  const list = [
    invoice('a', 'org1', 'draft', 100),
    invoice('b', 'org1', 'paid', 200),
    invoice('c', 'org2', 'issued', 300),
  ];

  it('filters to the selected ids', () => {
    assert.deepEqual(selectedInvoices(list, ['a', 'c']), [list[0], list[2]]);
    assert.deepEqual(selectedInvoices(list, []), []);
  });

  it('counts distinct organizations', () => {
    assert.equal(distinctOrgCount(selectedInvoices(list, ['a', 'b'])), 1);
    assert.equal(distinctOrgCount(selectedInvoices(list, ['a', 'c'])), 2);
  });

  it('sums totals', () => {
    assert.equal(sumTotal(selectedInvoices(list, ['a', 'b', 'c'])), 600);
  });
});

describe('planBulkTransition', () => {
  it('marks every draft eligible for issue', () => {
    const plan = planBulkTransition(
      [invoice('a', 'org1', 'draft'), invoice('b', 'org1', 'draft')],
      ['draft'],
      'Issue',
    );
    assert.equal(plan.eligible.length, 2);
    assert.equal(plan.ineligible.length, 0);
  });

  it('rejects non-draft invoices with a human-readable reason', () => {
    const plan = planBulkTransition(
      [invoice('a', 'org1', 'draft'), invoice('b', 'org1', 'paid')],
      ['draft'],
      'Issue',
    );
    assert.equal(plan.eligible.length, 1);
    assert.equal(plan.ineligible.length, 1);
    assert.match(plan.ineligible[0].reason, /Ready to send/);
    assert.match(plan.ineligible[0].reason, /Paid/);
  });
});

describe('planInvoicePackage', () => {
  it('refuses an empty selection', () => {
    const plan = planInvoicePackage([]);
    assert.equal(plan.ok, false);
    assert.match(plan.reason ?? '', /No invoices selected/);
  });

  it('refuses mixed organizations', () => {
    const plan = planInvoicePackage([
      invoice('a', 'org1', 'issued'),
      invoice('b', 'org2', 'issued'),
    ]);
    assert.equal(plan.ok, false);
    assert.match(plan.reason ?? '', /multiple organizations/);
  });

  it('accepts a single-organization selection with the grand total', () => {
    const plan = planInvoicePackage([
      invoice('a', 'org1', 'issued', 100),
      invoice('b', 'org1', 'paid', 250),
    ]);
    assert.equal(plan.ok, true);
    assert.equal(plan.orgId, 'org1');
    assert.equal(plan.total, 350);
    assert.equal(plan.invoices.length, 2);
  });
});