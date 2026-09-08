/**
 * Payout logic for the Super Admin Payments workspace — framework-free pure
 * functions that map the verified backend `Payment Operations` payload onto the
 * claim-centered Ready / Blocked / Paid model, and build the recording payload /
 * report output.
 *
 * Backend contract (frozen): a claim becomes payable when its status is
 * `to_be_paid`; its bank snapshot (`bankAccountNumber` + `bankName`) is the sole
 * source of truth for payout. A `to_be_paid` claim without a bank snapshot is
 * BLOCKED — never silently funded from another source.
 */

// ── Workspace input shapes (mirror of the backend payload) ──────────────────

export interface WorkspaceClaim {
  reimbursementId: string;
  claimNumber?: string;
  employeeName: string;
  amount: number;
  serviceDate?: string;
  queuedAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
}

export interface WorkspaceClinic {
  clinicId: string | null;
  clinicName: string | null;
  totalAmount: number;
  count: number;
  claims: WorkspaceClaim[];
}

export interface WorkspaceOrg {
  tenantId: string;
  tenantName: string;
  totalOutstanding: number;
  lastPaymentDate: string | null;
  clinics: WorkspaceClinic[];
}

// ── Flat, claim-centered model ──────────────────────────────────────────────

export interface PayoutClaim {
  claimId: string;
  claimNumber?: string;
  employeeName: string;
  orgId: string;
  orgName: string;
  clinicId: string | null;
  clinicName: string | null;
  amount: number;
  serviceDate?: string;
  queuedAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
}

export interface PayoutHistoryEntry {
  claimId: string;
  claimNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  orgName: string;
  clinicName: string | null;
  amount: number;
  paymentReference?: string;
  bankReference?: string;
  paidAt?: string;
  /** Operator-entered transfer date (falls back to `paidAt` in the UI). */
  paymentDate?: string;
  paidBy?: string;
  method?: string;
}

export type PayoutStatus = 'ready' | 'blocked';

export interface PayoutTotals {
  count: number;
  amount: number;
}

export interface ClinicGroup {
  clinicId: string | null;
  clinicName: string | null;
  claims: PayoutClaim[];
  totalAmount: number;
  count: number;
}

// ── Flatten + classify ──────────────────────────────────────────────────────

/** Flatten the org→clinic→claim workspace into a claim-level list with org/clinic context. */
export function flattenQueue(organizations: WorkspaceOrg[]): PayoutClaim[] {
  const out: PayoutClaim[] = [];
  for (const org of organizations) {
    for (const clinic of org.clinics) {
      for (const claim of clinic.claims) {
        out.push({
          claimId: claim.reimbursementId,
          claimNumber: claim.claimNumber,
          employeeName: claim.employeeName,
          orgId: org.tenantId,
          orgName: org.tenantName,
          clinicId: clinic.clinicId,
          clinicName: clinic.clinicName,
          amount: claim.amount,
          serviceDate: claim.serviceDate,
          queuedAt: claim.queuedAt,
          invoiceId: claim.invoiceId,
          invoiceNumber: claim.invoiceNumber,
          bankAccountNumber: claim.bankAccountNumber,
          bankName: claim.bankName,
        });
      }
    }
  }
  return out;
}

/** A claim is ready to pay only when its bank snapshot is complete. */
export function isPayoutReady(claim: Pick<PayoutClaim, 'bankAccountNumber' | 'bankName'>): boolean {
  return Boolean(claim.bankAccountNumber?.trim() && claim.bankName?.trim());
}

export function classifyPayout(claim: PayoutClaim): PayoutStatus {
  return isPayoutReady(claim) ? 'ready' : 'blocked';
}

/**
 * PA2-A item 6: single-pass classifier that partitions a list of payout claims
 * into ready/blocked in one iteration. Previously the page called
 * `filteredClaims.filter(...)` twice (once for ready, once for blocked), which
 * walked the entire filtered set twice and ran `classifyPayout` redundantly.
 * Use this in render paths that need both buckets simultaneously.
 */
export function partitionByPayoutStatus(claims: PayoutClaim[]): {
  ready: PayoutClaim[];
  blocked: PayoutClaim[];
} {
  const ready: PayoutClaim[] = [];
  const blocked: PayoutClaim[] = [];
  for (const claim of claims) {
    (isPayoutReady(claim) ? ready : blocked).push(claim);
  }
  return { ready, blocked };
}

/** Human-readable reason a claim is blocked (null when ready). */
export function blockReason(claim: PayoutClaim): string | null {
  return isPayoutReady(claim) ? null : 'Missing bank details on claim';
}

// ── Aggregation + grouping ──────────────────────────────────────────────────

export function summarizePayouts(claims: PayoutClaim[]): {
  ready: PayoutTotals;
  blocked: PayoutTotals;
} {
  const ready: PayoutTotals = { count: 0, amount: 0 };
  const blocked: PayoutTotals = { count: 0, amount: 0 };
  for (const claim of claims) {
    const bucket = isPayoutReady(claim) ? ready : blocked;
    bucket.count += 1;
    bucket.amount += claim.amount;
  }
  return { ready, blocked };
}

/** Group claims by clinic (with totals) for the clinic-grouped view. */
export function groupByClinic(claims: PayoutClaim[]): ClinicGroup[] {
  const map = new Map<string, ClinicGroup>();
  for (const claim of claims) {
    const key = claim.clinicId ?? '__no_clinic__';
    let group = map.get(key);
    if (!group) {
      group = {
        clinicId: claim.clinicId,
        clinicName: claim.clinicName,
        claims: [],
        totalAmount: 0,
        count: 0,
      };
      map.set(key, group);
    }
    group.claims.push(claim);
    group.totalAmount += claim.amount;
    group.count += 1;
  }
  return Array.from(map.values()).sort(
    (a, b) => (a.clinicName ?? 'No Clinic').localeCompare(b.clinicName ?? 'No Clinic'),
  );
}

// ── Duplicate-payment protection ────────────────────────────────────────────

/** Claim IDs that appear more than once in a selection (defensive dedupe). */
export function findDuplicateClaimIds(claimIds: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of claimIds) {
    if (seen.has(id)) dupes.add(id);
    else seen.add(id);
  }
  return Array.from(dupes);
}

/** Selected claim IDs that already have a recorded (paid) PaymentRecord. */
export function findAlreadyPaid(claimIds: string[], paidClaimIds: ReadonlySet<string>): string[] {
  return claimIds.filter((id) => paidClaimIds.has(id));
}

// ── Recording payload ───────────────────────────────────────────────────────

export interface PaymentRecordFields {
  paymentDate?: string;
  method?: string;
  bankReference?: string;
  notes?: string;
}

/** Build the `POST /process` body from a selection + operator-entered fields. */
export function buildPaymentPayload(
  claimIds: string[],
  fields: PaymentRecordFields,
): { claimIds: string[]; paymentDate?: string; method?: string; bankReference?: string; notes?: string } {
  const payload: { claimIds: string[]; paymentDate?: string; method?: string; bankReference?: string; notes?: string } = {
    claimIds,
  };
  if (fields.paymentDate?.trim()) payload.paymentDate = fields.paymentDate.trim();
  if (fields.method?.trim()) payload.method = fields.method.trim();
  if (fields.bankReference?.trim()) payload.bankReference = fields.bankReference.trim();
  if (fields.notes?.trim()) payload.notes = fields.notes.trim();
  return payload;
}

// ── Filtering + aging ───────────────────────────────────────────────────────

export interface PayoutFilter {
  query?: string;
  orgId?: string;
}

/** Client-side filter over the (already-loaded) queue: free-text + org scope. */
export function filterPayoutClaims(claims: PayoutClaim[], filter: PayoutFilter): PayoutClaim[] {
  const query = filter.query?.trim().toLowerCase();
  return claims.filter((claim) => {
    if (filter.orgId && claim.orgId !== filter.orgId) return false;
    if (!query) return true;
    const haystack = [
      claim.employeeName,
      claim.claimNumber,
      claim.invoiceNumber,
      claim.clinicName,
      claim.orgName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Whole days since a claim was queued (0 when queued today). */
export function daysQueued(queuedAt: string, now: number = Date.now()): number {
  const queued = new Date(queuedAt).getTime();
  if (Number.isNaN(queued)) return 0;
  return Math.max(0, Math.floor((now - queued) / 86400000));
}

// ── CSV report ──────────────────────────────────────────────────────────────

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(rows: (string | number | undefined)[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/** CSV of the current ready/blocked selection (for the report before transfer). */
export function buildPayoutCsv(claims: PayoutClaim[]): string {
  const header = ['Claim #', 'Employee', 'Organization', 'Clinic', 'Invoice', 'Bank Name', 'Account (last 4)', 'Amount (OMR)', 'Service Date', 'Queued'];
  const rows = claims.map((c) => [
    c.claimNumber ?? c.claimId,
    c.employeeName,
    c.orgName,
    c.clinicName ?? '',
    c.invoiceNumber ?? '',
    c.bankName ?? '',
    c.bankAccountNumber ? c.bankAccountNumber.slice(-4) : '',
    c.amount.toFixed(3),
    c.serviceDate ?? '',
    new Date(c.queuedAt).toISOString().slice(0, 10),
  ]);
  return toCsv([header, ...rows]);
}

/** CSV of the paid history for reconciliation. */
export function buildHistoryCsv(history: PayoutHistoryEntry[]): string {
  const header = ['Payment Ref', 'Bank Ref', 'Claim #', 'Invoice', 'Organization', 'Clinic', 'Amount (OMR)', 'Paid Date', 'Method', 'Paid By'];
  const rows = history.map((h) => [
    h.paymentReference ?? '',
    h.bankReference ?? '',
    h.claimNumber ?? '',
    h.invoiceNumber ?? '',
    h.orgName,
    h.clinicName ?? '',
    h.amount.toFixed(3),
    h.paymentDate ?? h.paidAt ?? '',
    h.method ?? '',
    h.paidBy ?? '',
  ]);
  return toCsv([header, ...rows]);
}
