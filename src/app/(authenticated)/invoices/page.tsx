'use client';

  import { useState, useEffect, useCallback } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import {
      ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download,
      Receipt, RefreshCw, Search, FileText, Wallet,
    } from 'lucide-react';
  import WorkflowStepper from '@/components/financial/WorkflowStepper';
  import WorkspaceSegments from '@/components/financial/WorkspaceSegments';
  import FinancialWorkflowHeader from '@/components/financial/FinancialWorkflowHeader';
  import FinancialExceptionBanner from '@/components/financial/FinancialExceptionBanner';
  import FinancialRecordLink from '@/components/financial/FinancialRecordLink';
  import FinancialStatusBadge from '@/components/financial/FinancialStatusBadge';
  import FinancialEmptyState from '@/components/financial/FinancialEmptyState';
  import { FinancialTableSkeleton } from '@/components/financial/FinancialSkeleton';
  import SuccessBanner from '@/components/financial/SuccessBanner';
  import { formatCurrency, formatDate } from '@/lib/financial/format';
  import { INVOICE_STATUS_DISPLAY, INVOICE_STATUS_TONE, type InvoiceStatus } from '@/lib/financial/status';
  import { useTenants } from '@/context/TenantsProvider';

// ── A/R lifecycle (frozen: draft → issued → paid → archived) ───────────────

interface ArInvoice {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  period: { from: string; to: string };
  status: InvoiceStatus;
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: Array<{
    claimId: string;
    claimNumber?: string;
    clinicName?: string;
    amount: number;
    sessionCount?: number;
    serviceDate?: string;
  }>;
}

interface OrgArSummary {
  orgId: string;
  orgName: string;
  totalOutstanding: number;
  overdueAmount: number;
  invoiceCount: number;
  lastInvoiceDate?: string;
  lastInvoiceNumber?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  arStatus: 'current' | '1-30' | '31-60' | '61-90' | '90+';
  aging: { current: number; '1-30': number; '31-60': number; '61-90': number; '90+': number };
}

interface ArLedgerResponse {
  organizations: OrgArSummary[];
  total: number;
  paidThisMonth?: { count: number; amount: number };
}

const PAGE_SIZE = 20;

const AGING_COLOR: Record<string, string> = {
  current: 'bg-green-100 text-green-800',
  '1-30': 'bg-green-100 text-green-700',
  '31-60': 'bg-yellow-100 text-yellow-800',
  '61-90': 'bg-orange-100 text-orange-800',
  '90+': 'bg-red-100 text-red-800',
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error;
    if (typeof body?.error?.message === 'string') return body.error.message;
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // PA2-A item 4: tenants list comes from shared TenantsProvider so we don't
  // refetch /api/super-admin/tenants on every workspace navigation.
  const { tenants } = useTenants();

  // Shared organization filter; skip resets on filter changes.
  const [orgFilter, setOrgFilter] = useState('');

  // Invoices list state (with its own pagination).
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invSkip, setInvSkip] = useState(0);
  const [invoices, setInvoices] = useState<ArInvoice[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState<string | null>(null);

  // The "Outstanding Organization Payments" view is reached from the dashboard
  // Attention Queue / WorkflowState via `/invoices?status=issued`. It is NOT a
  // new state — `issued` remains the underlying invoice status. This page
  // simply surfaces those invoices as a focused workflow with a per-row
  // "Record organization payment" action, while the full table below stays the
  // complete invoice register.
  const isAwaitingView = searchParams.get('status') === 'issued';
  const outstandingCount = invoices.length;
  const outstandingTotal = invoices.reduce((s, i) => s + i.totalAmount, 0);

  // Per-invoice "record payment" flow. The backend endpoint is
  // POST /api/super-admin/invoices/[id]/pay — single invoice, no body, and it
  // is the authoritative organization-payment action (it also queues the
  // linked claims for clinic payout). There is no bulk variant today.
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  async function recordOrganizationPayment(invoice: ArInvoice) {
    if (payingInvoiceId) return;
    setPayingInvoiceId(invoice.invoiceId);
    setPayError(null);
    setPaySuccess(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoice.invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to record payment for ${invoice.invoiceNumber}.`);
      }
      setPaySuccess(`Payment recorded for ${invoice.invoiceNumber}. Claims are now queued for clinic payout.`);
      setPayingInvoiceId(null);
      setInvSkip(0);
      void fetchInvoices();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed to record payment.');
      setPayingInvoiceId(null);
    }
  }

  // Ledger state (with its own pagination).
  const [daysFilter, setDaysFilter] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSkip, setLedgerSkip] = useState(0);
  const [orgs, setOrgs] = useState<OrgArSummary[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [paidThisMonth, setPaidThisMonth] = useState<{ count: number; amount: number }>({
    count: 0,
    amount: 0,
  });
  // The A/R ledger is a finance-controller reconciliation view, not part of
  // the operator's invoice workflow. It is collapsed by default so the page
  // surfaces only the invoice list; expanding it fetches the aging data on
  // demand. This keeps the operator's mental model simple without dropping the
  // report for whoever needs it.
  const [ledgerExpanded, setLedgerExpanded] = useState(false);

  const orgNameOf = useCallback(
    (tenantId: string) => tenants.find((t) => t.id === tenantId)?.name ?? tenantId,
    [tenants],
  );

  // ── Invoices list ─────────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    setInvLoading(true);
    setInvError(null);
    try {
      const params = new URLSearchParams();
      if (orgFilter) params.set('tenantId', orgFilter);
      if (invStatusFilter) params.set('status', invStatusFilter);
      params.set('skip', String(invSkip));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/super-admin/invoices?${params.toString()}`);
      if (!res.ok) {
        setInvError(await readError(res));
        setInvoices([]);
        setInvTotal(0);
        return;
      }
      const data: { invoices: ArInvoice[]; total: number } = await res.json();
      setInvoices(data.invoices ?? []);
      setInvTotal(data.total ?? 0);
    } catch (err) {
      setInvError(getErrorMessage(err));
      setInvoices([]);
      setInvTotal(0);
    } finally {
      setInvLoading(false);
    }
  }, [orgFilter, invStatusFilter, invSkip]);

  // ── Ledger ────────────────────────────────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    setLedgerLoading(true);
    setLedgerError(null);
    try {
      const params = new URLSearchParams();
      if (orgFilter) params.set('tenantId', orgFilter);
      if (daysFilter) params.set('daysOutstanding', daysFilter);
      if (ledgerSearch.trim()) params.set('search', ledgerSearch.trim());
      params.set('skip', String(ledgerSkip));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/super-admin/invoices/ledger?${params.toString()}`);
      if (!res.ok) {
        setLedgerError(await readError(res));
        setOrgs([]);
        setLedgerTotal(0);
        return;
      }
      const data: ArLedgerResponse = await res.json();
      setOrgs(data.organizations ?? []);
      setLedgerTotal(data.total ?? 0);
      setPaidThisMonth(data.paidThisMonth ?? { count: 0, amount: 0 });
    } catch (err) {
      setLedgerError(getErrorMessage(err));
      setOrgs([]);
      setLedgerTotal(0);
    } finally {
      setLedgerLoading(false);
    }
  }, [orgFilter, daysFilter, ledgerSearch, ledgerSkip]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    // Only fetch the A/R ledger when the operator expands it — the aging data
    // is not part of the default invoice workflow.
    if (ledgerExpanded) void fetchLedger();
  }, [ledgerExpanded, fetchLedger]);

  function exportOrgCsv(orgId: string) {
    window.open(`/api/super-admin/invoices/export/${orgId}`, '_blank');
  }

  function exportAgingReport() {
    window.open('/api/super-admin/invoices/report/aging', '_blank');
  }

  function viewOrgInvoices(org: OrgArSummary) {
    setOrgFilter(org.orgId);
    setInvStatusFilter('');
    setInvSkip(0);
  }

  const invTotalPages = Math.max(1, Math.ceil(invTotal / PAGE_SIZE));
  const invCurrentPage = Math.floor(invSkip / PAGE_SIZE) + 1;
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerTotal / PAGE_SIZE));
  const ledgerCurrentPage = Math.floor(ledgerSkip / PAGE_SIZE) + 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <FinancialWorkflowHeader
        icon={<Receipt className="h-6 w-6 text-primary" />}
        iconContainerClass="bg-primary/10"
        title="Invoices & A/R"
        subtitle="Review invoices, record organization payment, and track accounts receivable — who owes Remedy money."
        actions={
          <>
            <a
              href="/reimbursements"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <FileText className="h-4 w-4" />
              Start billing
            </a>
            <button
              onClick={() => {
                void fetchInvoices();
                void fetchLedger();
              }}
              disabled={invLoading || ledgerLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${invLoading || ledgerLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <WorkflowStepper current="invoices" />
        <WorkspaceSegments active="invoices" />

        {/* ── Invoices section ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <header className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
              <p className="text-sm text-gray-500">Every invoice generated for an organization. Open one to issue or record payment.</p>
            </div>
          </header>

          <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
              <select
                value={orgFilter}
                onChange={(e) => {
                  setOrgFilter(e.target.value);
                  setInvSkip(0);
                  setLedgerSkip(0);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Organizations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
              <select
                value={invStatusFilter}
                onChange={(e) => {
                  setInvStatusFilter(e.target.value);
                  setInvSkip(0);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                {(['draft', 'issued', 'paid', 'archived'] as const).map((s) => (
                  <option key={s} value={s}>
                    {INVOICE_STATUS_DISPLAY[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {invLoading && <FinancialTableSkeleton rows={6} columns={6} />}

          {!invLoading && invError && (
            <FinancialExceptionBanner
              title="Cannot load invoices"
              exceptions={[invError]}
              onDismiss={() => setInvError(null)}
            />
          )}

          {/* Focused "Outstanding Organization Payments" view — surfaced from the
              dashboard when the operator lands here via /invoices?status=issued.
              `issued` is the real invoice state; this is the human workflow
              around it. The full register is one click away. */}
          {isAwaitingView && !invLoading && !invError && paySuccess && (
            <SuccessBanner
              message={paySuccess}
              action={{ href: '/payments', label: 'Go To Payments' }}
            />
          )}
          {isAwaitingView && !invLoading && !invError && payError && (
            <FinancialExceptionBanner
              title="Could not record payment"
              exceptions={[payError]}
              onDismiss={() => setPayError(null)}
            />
          )}
          {isAwaitingView && !invLoading && !invError && invoices.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-blue-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Outstanding organization payments
                    </p>
                    <p className="text-xs text-blue-700">
                      These invoices are issued and waiting on organization payment. Record payment once it arrives — the linked claims then move to the clinic payout queue.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold tabular-nums text-blue-900">
                    {formatCurrency(outstandingTotal)}
                  </p>
                  <p className="text-xs text-blue-700">
                    {outstandingCount} invoice{outstandingCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!invLoading && !invError && invoices.length === 0 && (
            <FinancialEmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No invoices"
              description="No invoices match these filters. Generate an invoice from approved claims on the Claims page."
            />
          )}

          {!invLoading && !invError && invoices.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Issued</th>
                    <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Paid</th>
                    {isAwaitingView && (
                      <th className="px-4 py-3 font-semibold text-gray-600 text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.invoiceId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <FinancialRecordLink
                          kind="invoice"
                          href={`/invoices/${invoice.invoiceId}`}
                          reference={invoice.invoiceNumber}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-900">{orgNameOf(invoice.tenantId)}</td>
                      <td className="px-4 py-3 font-medium tabular-nums text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <FinancialStatusBadge
                          label={INVOICE_STATUS_DISPLAY[invoice.status]}
                          tone={INVOICE_STATUS_TONE[invoice.status]}
                        />
                      </td>
                      <td className="hidden px-4 py-3 text-gray-500 md:table-cell">
                        {formatDate(invoice.issuedAt)}
                      </td>
                      <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">
                        {formatDate(invoice.paidAt)}
                      </td>
                      {isAwaitingView && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => recordOrganizationPayment(invoice)}
                            disabled={payingInvoiceId === invoice.invoiceId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {payingInvoiceId === invoice.invoiceId ? 'Recording…' : 'Record payment'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Back to the full register from the focused view. */}
          {isAwaitingView && !invLoading && !invError && invoices.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push('/invoices')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back to full invoice register
              </button>
            </div>
          )}

          {!invLoading && !invError && invTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {invSkip + 1}–{Math.min(invSkip + PAGE_SIZE, invTotal)} of {invTotal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInvSkip(Math.max(0, invSkip - PAGE_SIZE))}
                  disabled={invSkip <= 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-2 text-sm text-gray-500">
                  Page {invCurrentPage} of {invTotalPages}
                </span>
                <button
                  onClick={() => setInvSkip(Math.min((invTotalPages - 1) * PAGE_SIZE, invSkip + PAGE_SIZE))}
                  disabled={invSkip + PAGE_SIZE >= invTotal}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── A/R Ledger section (collapsed by default) ─────────────────────── */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLedgerExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-left"
              aria-expanded={ledgerExpanded}
            >
              {ledgerExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              )}
              <div>
                <h2 className="text-base font-semibold text-gray-900">Accounts Receivable</h2>
                <p className="text-sm text-gray-500">
                  {ledgerExpanded
                    ? 'Outstanding balances per organization.'
                    : 'Collapsed — outstanding balances per organization.'}
                </p>
              </div>
            </button>
            {ledgerExpanded && (
              <button
                onClick={exportAgingReport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Aging Report
              </button>
            )}
          </div>

          {ledgerExpanded && (
            <>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm text-gray-600">
              Paid this month:{' '}
              <span className="font-semibold text-gray-900">{formatCurrency(paidThisMonth.amount)}</span>
              <span className="ml-1 text-xs text-gray-400">
                ({paidThisMonth.count} invoice{paidThisMonth.count === 1 ? '' : 's'})
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Days Outstanding</label>
              <select
                value={daysFilter}
                onChange={(e) => {
                  setDaysFilter(e.target.value);
                  setLedgerSkip(0);
                }}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option value="current">Current (0-30)</option>
                <option value="1-30">1-30 days</option>
                <option value="31-60">31-60 days</option>
                <option value="61-90">61-90 days</option>
                <option value="90+">90+ days</option>
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Organization name"
                  value={ledgerSearch}
                  onChange={(e) => {
                    setLedgerSearch(e.target.value);
                    setLedgerSkip(0);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm"
                />
              </div>
            </div>
          </div>

          {ledgerLoading && <FinancialTableSkeleton rows={6} columns={7} />}

          {!ledgerLoading && ledgerError && (
            <FinancialExceptionBanner
              title="Cannot load ledger"
              exceptions={[ledgerError]}
              onDismiss={() => setLedgerError(null)}
            />
          )}

          {!ledgerLoading && !ledgerError && orgs.length === 0 && (
            <FinancialEmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No accounts receivable"
              description="No organizations match these filters. Issued invoices appear here as outstanding balances."
            />
          )}

          {!ledgerLoading && !ledgerError && orgs.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Total Outstanding</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Overdue (&gt;30d)</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Open Invoices</th>
                    <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Last Invoice</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.orgId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{org.orgName}</td>
                      <td className="px-4 py-3 font-medium tabular-nums text-gray-900">
                        {formatCurrency(org.totalOutstanding)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {formatCurrency(org.overdueAmount)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{org.invoiceCount}</td>
                      <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">
                        {org.lastInvoiceNumber ?? '—'}
                        <br />
                        {formatDate(org.lastInvoiceDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${AGING_COLOR[org.arStatus] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {org.arStatus === 'current' || org.arStatus === '1-30' ? 'Current' : org.arStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => viewOrgInvoices(org)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            View Invoices
                          </button>
                          <button
                            onClick={() => exportOrgCsv(org.orgId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="h-3 w-3" /> Export
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ledgerTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {ledgerSkip + 1}–{Math.min(ledgerSkip + PAGE_SIZE, ledgerTotal)} of {ledgerTotal}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLedgerSkip(Math.max(0, ledgerSkip - PAGE_SIZE))}
                  disabled={ledgerSkip <= 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="px-2 text-sm text-gray-500">
                  Page {ledgerCurrentPage} of {ledgerTotalPages}
                </span>
                <button
                  onClick={() => setLedgerSkip(Math.min((ledgerTotalPages - 1) * PAGE_SIZE, ledgerSkip + PAGE_SIZE))}
                  disabled={ledgerSkip + PAGE_SIZE >= ledgerTotal}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  </div>
</div>
  );
}
