import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGenerateRequest, buildInvoiceReviewSummary } from '../invoice';

describe('buildGenerateRequest', () => {
  it('mirrors the frozen generate contract: one org + explicit claim ids', () => {
    assert.deepEqual(buildGenerateRequest('tenant_1', ['c1', 'c2']), {
      tenantId: 'tenant_1',
      claimIds: ['c1', 'c2'],
    });
  });

  it('never accepts a date range (only tenantId + claimIds)', () => {
    const req = buildGenerateRequest('tenant_1', []);
    assert.deepEqual(Object.keys(req).sort(), ['claimIds', 'tenantId']);
  });
});

describe('buildInvoiceReviewSummary', () => {
  it('sums amount, counts claims, and dedupes clinics', () => {
    const summary = buildInvoiceReviewSummary('org_1', 'Acme', [
      { clinicName: 'Clinic A', amount: 100 },
      { clinicName: 'Clinic A', amount: 50 },
      { clinicName: 'Clinic B', amount: 25.5 },
    ]);
    assert.equal(summary.orgId, 'org_1');
    assert.equal(summary.orgName, 'Acme');
    assert.equal(summary.claimCount, 3);
    assert.equal(summary.clinicCount, 2);
    assert.equal(summary.totalAmount, 175.5);
  });

  it('ignores null/undefined clinic names in the dedupe count', () => {
    const summary = buildInvoiceReviewSummary('org_1', 'Acme', [
      { clinicName: null, amount: 10 },
      { clinicName: undefined, amount: 20 },
      { clinicName: 'Clinic A', amount: 30 },
    ]);
    assert.equal(summary.claimCount, 3);
    assert.equal(summary.clinicCount, 1);
    assert.equal(summary.totalAmount, 60);
  });

  it('handles an empty selection', () => {
    const summary = buildInvoiceReviewSummary('org_1', 'Acme', []);
    assert.equal(summary.claimCount, 0);
    assert.equal(summary.clinicCount, 0);
    assert.equal(summary.totalAmount, 0);
  });
});
