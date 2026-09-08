import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { runMongoScript } from '@/server/mongo-shell';
import { topOrgsByWork } from '@/lib/dashboard/grouping';
import type {
  DashboardSummary,
  RecentActivityItem,
  StageCounts,
} from '@/lib/dashboard/types';

export const runtime = 'nodejs';

/**
 * Super Admin Dashboard — Composed Summary
 *
 * A single server round-trip that composes all data the dashboard renders.
 * This is *composition*, not application-wide caching — sections render
 * independently, and a per-section failure surfaces locally rather than
 * collapsing the page.
 *
 * Upstream work performed (all in parallel):
 *   - reimbursements (status=approved, to_be_paid)  — tenantapp proxy
 *   - invoices (status=issued, paid)               — tenantapp proxy
 *   - payments/operations (payment history)        — tenantapp proxy
 *   - tenants/stats (active orgs + counts)          — admin (direct;
 *     status counts are indexed countDocuments)
 *   - clinics active count                          — admin (direct countDocuments)
 *   - employees active count                        — tenantapp proxy
 *     (uses response.total so the existing findAll countDocuments is reused)
 *   - notifications/unread-count                    — admin (direct)
 *
 * PA2-B removed: the `/api/super-admin/payments` round-trip — its data was
 * not consumed in the summary output. The clinic count moved off the
 * HTTP-list endpoint (which ignored `limit=1` and returned every clinic) to
 * a direct `countDocuments` against the admin's own collection.
 *
 * PA2-C: the `getTenantStats` service now resolves status counts via
 * indexed `countDocuments` queries (cheap) in parallel with the heavier
 * branding/submission aggregates (which still need the tenant docs).
 * The composed summary remains the only browser-facing dashboard request.
 *
 * 14-day "overdue" payment aging is intentionally absent — that was an
 * invented SLA the previous audit removed. We surface only
 * `invoicesOver7Days` as *informational* (never drives an action).
 */

const TIMEOUT_MS = 10_000;

interface ClaimRow {
  reimbursementId: string;
  claimNumber?: string;
  tenantId: string;
  tenantName: string;
  employeeName: string;
  clinicName?: string;
  amount: number;
  status: string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  status: 'draft' | 'issued' | 'paid' | 'archived';
  generatedAt: string;
  issuedAt?: string | null;
  paidAt?: string | null;
  totalAmount: number;
}

interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  draftTenants?: number;
  disabledTenants?: number;
  archivedTenants?: number;
}

interface PaymentHistoryEntry {
  paymentRecordId: string;
  claimId: string;
  claimNumber?: string;
  tenantName: string;
  clinicName: string | null;
  amount: number;
  paidAt?: string;
}

interface PaymentsOperations {
  summary?: { outstanding: { count: number; amount: number }; paidToday: { count: number; amount: number } };
  organizations?: unknown[];
  paymentHistory?: PaymentHistoryEntry[];
}

async function safeFetchJson<T>(url: string, init: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const empty: StageCounts = { count: 0, amount: 0 };

function sumAmount<T>(
  rows: ReadonlyArray<T>,
  predicate: ((r: T) => boolean) | undefined,
  amountKey: 'amount' | 'totalAmount',
): StageCounts {
  const filtered = predicate ? rows.filter(predicate) : rows;
  let total = 0;
  for (const r of filtered) {
    const v = (r as Record<string, unknown>)[amountKey];
    total += Number(v ?? 0);
  }
  return { count: filtered.length, amount: total };
}

function monthBounds(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pickRecent(items: RecentActivityItem[], max = 12): RecentActivityItem[] {
  return items
    .filter((it) => Number.isFinite(new Date(it.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, max);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  // Build a base URL that we can use for internal calls. We deliberately do
  // not rely on the public-facing host because the admin runs behind a
  // reverse proxy; an absolute origin would tie this route to a deployment
  // configuration we don't control.
  const origin = new URL(request.url).origin;

  const headers = { 'x-admin-api-key': process.env.ADMIN_API_KEY ?? '' };

  const [
    approvedClaimsRes,
    toBePaidClaimsRes,
    issuedInvoicesRes,
    paidInvoicesRes,
    paymentsOpsRes,
    tenantStatsRes,
    employeesRes,
    notificationsRes,
    clinicsCount,
  ] = await Promise.all([
    safeFetchJson<{ claims: ClaimRow[] }>(
      `${origin}/api/super-admin/reimbursements?status=approved&limit=500`,
      { method: 'GET', headers },
    ),
    safeFetchJson<{ claims: ClaimRow[] }>(
      `${origin}/api/super-admin/reimbursements?status=to_be_paid&limit=500`,
      { method: 'GET', headers },
    ),
    safeFetchJson<{ invoices: InvoiceRow[] }>(
      `${origin}/api/super-admin/invoices?status=issued&limit=500`,
      { method: 'GET', headers },
    ),
    safeFetchJson<{ invoices: InvoiceRow[] }>(
      `${origin}/api/super-admin/invoices?status=paid&limit=500`,
      { method: 'GET', headers },
    ),
    // History records — only used for the recent-activity feed.
    safeFetchJson<PaymentsOperations>(
      `${origin}/api/super-admin/payments/operations`,
      { method: 'GET', headers },
    ),
    safeFetchJson<TenantStats>(
      `${origin}/api/super-admin/tenants/stats`,
      { method: 'GET', headers },
    ),
    // Active employee count. The tenant app endpoint returns { employees, total }
    // and runs countDocuments server-side, so we read `total` and ignore the
    // (size-1) employee list. The proxy call is preserved (Phase 5) because
    // employees live in tenantapp, not admin.
    safeFetchJson<{ total: number; employees: { employeeId: string }[] }>(
      `${origin}/api/super-admin/employees?status=active&limit=1`,
      { method: 'GET', headers },
    ),
    safeFetchJson<{ unread?: number; count?: number }>(
      `${origin}/api/super-admin/notifications/unread-count`,
      { method: 'GET', headers },
    ),
    // Active clinic count — direct Mongo. Admin owns the `clinics` collection.
    // The earlier HTTP-list call returned the entire collection regardless of
    // `limit=1`, defeating the lightweight intent.
    runMongoScript<{ count: number }>(
      `const count = db.clinics.countDocuments({ status: "active" }); __emit({ count });`,
      undefined,
      { label: 'dashboard.clinics-active-count', targetDb: 'remedygcc' },
    ).catch(() => ({ count: 0 })),
  ]);

  // ── Workflow ─────────────────────────────────────────────────────────────
  const approved = approvedClaimsRes?.claims ?? [];
  const toBePaid = toBePaidClaimsRes?.claims ?? [];
  const issued = issuedInvoicesRes?.invoices ?? [];
  const paid = paidInvoicesRes?.invoices ?? [];

  // Ready for billing = approved AND not yet referenced by any invoice.
  // Invoice-link is carried on the claim row as `invoiceId` (Phase-2 join).
  const readyForBilling = sumAmount<ClaimRow>(
    approved,
    (c) => !c.invoiceId,
    'amount',
  );

  // Split to_be_paid by bank completeness (Phase-6 `missing_bank` reason).
  const hasBank = (c: ClaimRow) => !!(c.bankAccountNumber && c.bankName);
  const readyToPay = sumAmount<ClaimRow>(toBePaid, hasBank, 'amount');
  const blocked = sumAmount<ClaimRow>(toBePaid, (c) => !hasBank(c), 'amount');

  // Awaiting organization payment — issued invoices.
  const awaitingOrgPayment = sumAmount(issued, undefined, 'totalAmount');

  // Paid this month — invoices paid in the current calendar month.
  const { start: monthStart, end: monthEnd } = monthBounds();
  const paidThisMonth = sumAmount(
    paid,
    (inv: InvoiceRow) => !!inv.paidAt && inv.paidAt >= monthStart && inv.paidAt < monthEnd,
    'totalAmount',
  );

  // ── Attention ────────────────────────────────────────────────────────────
  const nowMs = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const invoicesOver7Days = sumAmount(
    issued,
    (inv: InvoiceRow) => !!inv.issuedAt && nowMs - new Date(inv.issuedAt).getTime() > SEVEN_DAYS,
    'totalAmount',
  );

  // ── Recent activity (composed from invoices + history + ready queue) ────
  const recent: RecentActivityItem[] = [];

  for (const inv of issued.slice(0, 6)) {
    recent.push({
      kind: 'invoice_issued',
      id: inv.invoiceId,
      number: inv.invoiceNumber,
      tenantName: inv.tenantName ?? '',
      amount: inv.totalAmount,
      at: inv.issuedAt ?? inv.generatedAt,
    });
  }
  for (const inv of paid.slice(0, 6)) {
    if (!inv.paidAt) continue;
    recent.push({
      kind: 'invoice_paid',
      id: inv.invoiceId,
      number: inv.invoiceNumber,
      tenantName: inv.tenantName ?? '',
      amount: inv.totalAmount,
      at: inv.paidAt,
    });
  }
  for (const h of (paymentsOpsRes?.paymentHistory ?? []).slice(0, 6)) {
    if (!h.paidAt) continue;
    recent.push({
      kind: 'payment_recorded',
      id: h.paymentRecordId,
      claimId: h.claimId,
      clinicName: h.clinicName ?? '',
      amount: h.amount,
      at: h.paidAt,
    });
  }
  for (const c of toBePaid.slice(0, 6)) {
    recent.push({
      kind: 'claim_ready',
      id: c.reimbursementId,
      claimNumber: c.claimNumber ?? c.reimbursementId,
      employeeName: c.employeeName ?? '',
      amount: c.amount,
      at: c.updatedAt ?? c.createdAt,
    });
  }

  // ── Operational context ─────────────────────────────────────────────────
  // The tenants/stats endpoint already gives us an authoritative active
  // count. We don't need to fetch the full tenants list.
  // PA3: top orgs by work-in-flight (issued invoices + to_be_paid claims).
  // Computed server-side from the rows the summary already pulled.
  const concentration = topOrgsByWork(toBePaid, issued, 3);

  const summary: DashboardSummary = {
    generatedAt: new Date().toISOString(),
    workflow: {
      readyForBilling,
      awaitingOrgPayment,
      readyToPay,
      blocked,
      paidThisMonth: paidThisMonth.count > 0 ? paidThisMonth : empty,
    },
    attention: {
      blockedByBank: blocked,
      invoicesOver7Days,
    },
    recent: pickRecent(recent, 12),
    context: {
      organizationsActive: tenantStatsRes?.activeTenants ?? 0,
      clinicsActive: clinicsCount?.count ?? 0,
      employeesActive: employeesRes?.total ?? 0,
      notificationsUnread: notificationsRes?.unread ?? notificationsRes?.count ?? 0,
    },
    concentration,
  };

  return NextResponse.json(summary, { status: 200 });
}