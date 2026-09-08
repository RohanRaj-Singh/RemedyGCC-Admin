import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  flattenQueue,
  isPayoutReady,
  classifyPayout,
  blockReason,
  summarizePayouts,
  groupByClinic,
  findDuplicateClaimIds,
  findAlreadyPaid,
  buildPaymentPayload,
  filterPayoutClaims,
  daysQueued,
  buildPayoutCsv,
  buildHistoryCsv,
  type WorkspaceOrg,
  type PayoutClaim,
} from '../payout';

const org: WorkspaceOrg = {
  tenantId: 'org_a',
  tenantName: 'Alpha Org',
  totalOutstanding: 150,
  lastPaymentDate: null,
  clinics: [
    {
      clinicId: 'clinic_x',
      clinicName: 'X Clinic',
      totalAmount: 100,
      count: 2,
      claims: [
        {
          reimbursementId: 'c1',
          claimNumber: 'CLM-001',
          employeeName: 'Employee One',
          amount: 50,
          queuedAt: '2026-08-20T00:00:00.000Z',
          invoiceId: 'inv_1',
          invoiceNumber: 'INV-0001',
          bankAccountNumber: 'ACCT-1111',
          bankName: 'Bank A',
        },
        {
          reimbursementId: 'c2',
          claimNumber: 'CLM-002',
          employeeName: 'Employee Two',
          amount: 50,
          queuedAt: '2026-08-20T00:00:00.000Z',
          // No bank → blocked.
        },
      ],
    },
    {
      clinicId: null,
      clinicName: null,
      totalAmount: 50,
      count: 1,
      claims: [
        {
          reimbursementId: 'c3',
          claimNumber: 'CLM-003',
          employeeName: 'Employee Three',
          amount: 50,
          queuedAt: '2026-08-20T00:00:00.000Z',
          bankAccountNumber: 'ACCT-3333',
          bankName: 'Bank C',
        },
      ],
    },
  ],
};

describe('flattenQueue', () => {
  it('attaches org + clinic context to every claim', () => {
    const claims = flattenQueue([org]);
    assert.equal(claims.length, 3);

    const c1 = claims.find((c) => c.claimId === 'c1')!;
    assert.equal(c1.orgId, 'org_a');
    assert.equal(c1.orgName, 'Alpha Org');
    assert.equal(c1.clinicId, 'clinic_x');
    assert.equal(c1.clinicName, 'X Clinic');
    assert.equal(c1.bankAccountNumber, 'ACCT-1111');

    const c3 = claims.find((c) => c.claimId === 'c3')!;
    assert.equal(c3.clinicId, null);
    assert.equal(c3.bankName, 'Bank C');
  });
});

describe('isPayoutReady / classifyPayout / blockReason', () => {
  it('ready requires both account and bank name', () => {
    assert.equal(isPayoutReady({ bankAccountNumber: 'A', bankName: 'B' }), true);
    assert.equal(isPayoutReady({ bankAccountNumber: 'A', bankName: '' }), false);
    assert.equal(isPayoutReady({ bankAccountNumber: '', bankName: 'B' }), false);
    assert.equal(isPayoutReady({}), false);
  });

  it('classifies a missing-bank claim as blocked with a reason', () => {
    const claims = flattenQueue([org]);
    const blocked = claims.find((c) => c.claimId === 'c2')!;
    assert.equal(classifyPayout(blocked), 'blocked');
    assert.equal(blockReason(blocked), 'Missing bank details on claim');

    const ready = claims.find((c) => c.claimId === 'c1')!;
    assert.equal(classifyPayout(ready), 'ready');
    assert.equal(blockReason(ready), null);
  });
});

describe('summarizePayouts', () => {
  it('splits ready vs blocked counts and amounts', () => {
    const claims = flattenQueue([org]);
    const { ready, blocked } = summarizePayouts(claims);
    assert.deepEqual(ready, { count: 2, amount: 100 });
    assert.deepEqual(blocked, { count: 1, amount: 50 });
  });
});

describe('groupByClinic', () => {
  it('groups claims by clinic with totals and stable sorting', () => {
    const groups = groupByClinic(flattenQueue([org]));
    assert.equal(groups.length, 2);

    const x = groups.find((g) => g.clinicId === 'clinic_x')!;
    assert.equal(x.count, 2);
    assert.equal(x.totalAmount, 100);

    const none = groups.find((g) => g.clinicId === null)!;
    assert.equal(none.count, 1);
    assert.equal(none.totalAmount, 50);
  });
});

describe('duplicate-payment protection', () => {
  it('finds duplicated claim ids in a selection', () => {
    assert.deepEqual(findDuplicateClaimIds(['a', 'b', 'a', 'c', 'b']), ['a', 'b']);
    assert.deepEqual(findDuplicateClaimIds(['a', 'b', 'c']), []);
  });

  it('finds selected ids that are already paid', () => {
    const paid = new Set(['c1', 'c9']);
    assert.deepEqual(findAlreadyPaid(['c1', 'c2', 'c9'], paid), ['c1', 'c9']);
    assert.deepEqual(findAlreadyPaid(['c2', 'c3'], paid), []);
  });
});

describe('buildPaymentPayload', () => {
  it('omits blank fields and preserves filled ones', () => {
    const payload = buildPaymentPayload(['c1'], {
      paymentDate: '2026-08-20',
      method: '  ',
      bankReference: 'TRF-1',
      notes: '',
    });
    assert.deepEqual(payload, { claimIds: ['c1'], paymentDate: '2026-08-20', bankReference: 'TRF-1' });
  });
});

describe('filterPayoutClaims', () => {
  const claims = flattenQueue([org]);

  it('filters by free text across employee/claim/invoice/clinic/org', () => {
    assert.equal(filterPayoutClaims(claims, { query: 'employee two' }).length, 1);
    assert.equal(filterPayoutClaims(claims, { query: 'INV-0001' }).length, 1);
    assert.equal(filterPayoutClaims(claims, { query: 'alpha' }).length, 3);
  });

  it('scopes by organization', () => {
    assert.equal(filterPayoutClaims(claims, { orgId: 'org_a' }).length, 3);
    assert.equal(filterPayoutClaims(claims, { orgId: 'org_other' }).length, 0);
  });
});

describe('daysQueued', () => {
  it('computes whole days elapsed', () => {
    const base = new Date('2026-08-20T00:00:00.000Z').getTime();
    assert.equal(daysQueued('2026-08-20T00:00:00.000Z', base), 0);
    assert.equal(daysQueued('2026-08-17T00:00:00.000Z', base), 3);
    assert.equal(daysQueued('not-a-date', base), 0);
  });
});

describe('CSV reports', () => {
  it('emits a header + one row per ready claim', () => {
    const claims = flattenQueue([org]).filter(isPayoutReady);
    const csv = buildPayoutCsv(claims);
    const lines = csv.split('\n');
    assert.equal(lines.length, 3); // header + 2 ready claims
    assert.match(lines[0], /^"Claim #"/);
    assert.match(lines[1], /CLM-001/);
  });

  it('emits a paid-history CSV with payment date and method', () => {
    const csv = buildHistoryCsv([
      {
        claimId: 'c1',
        claimNumber: 'CLM-001',
        orgName: 'Alpha Org',
        clinicName: 'X Clinic',
        amount: 50,
        paymentReference: 'PAY-2026-000001',
        paymentDate: '2026-08-20',
        method: 'Bank transfer',
      },
    ]);
    assert.match(csv, /PAY-2026-000001/);
    assert.match(csv, /Bank transfer/);
  });
});

// Keep a value reference so the import is used even if some test files tree-shake.
const _sample: PayoutClaim[] = flattenQueue([org]);
void _sample;
