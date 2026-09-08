'use client';

  import { useState, useEffect, useCallback, type ReactNode } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import {
      Archive, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download,
      Printer, Receipt, RefreshCw, Search, Send, FileText, Wallet, X,
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
  import PrintableInvoicePackage from '@/components/financial/PrintableInvoicePackage';
  import {
    deselectPageInvoices,
    distinctOrgCount,
    planBulkTransition,
    planInvoicePackage,
    selectPageInvoices,
    selectedInvoices,
    toggleInvoiceSelection,
  } from '@/lib/financial/invoiceSelection';
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

/** Minimal inline confirmation modal (the page convention — no dialog kit). */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 print:hidden">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="mt-2 space-y-2 text-sm text-gray-600">{children}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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

  // ── Bulk selection (bulk-invoice audit Phases A–C) ──────────────────────────
  // Selection is scoped to the current page and cleared whenever the list scope
  // (organization / status / pagination) changes, so a selection can never
  // silently span organizations or stale rows. Bulk issue/archive reuse the
  // per-invoice state rules (the backend re-validates every invoice); the PDF
  // package is an organization-scoped delivery convenience, never a financial
  // document — it changes no state.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    kind: 'issue' | 'archive';
    ok: number;
    skipped: Array<{ invoiceNumber: string; reason: string }>;
  } | null>(null);
  const [confirmBulkIssue, setConfirmBulkIssue] = useState(false);
  const [confirmBulkArchive, setConfirmBulkArchive] = useState(false);
  const [confirmPackage, setConfirmPackage] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);

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

  // ── Bulk plan + handlers (bulk-invoice audit Phases A–C) ────────────────────
  // The plan is advisory (pure, unit-tested helpers) — the backend re-validates
  // every invoice individually with the same rules as the single-invoice
  // workflow and reports per-item outcomes. Nothing is silently partial: the
  // confirmation shows exactly what will happen and the result lists every
  // skipped invoice with its reason.
  const selected = selectedInvoices(invoices, selectedIds);
  const issuePlan = planBulkTransition(selected, ['draft'], 'Issue');
  const archivePlan = planBulkTransition(selected, ['paid'], 'Archive');
  const packagePlan = planInvoicePackage(selected);
  const visibleIds = invoices.map((invoice) => invoice.invoiceId);
  const pageFullySelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  async function runBulkTransition(kind: 'issue' | 'archive', invoiceIds: string[]) {
    if (invoiceIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkResult(null);
    setConfirmBulkIssue(false);
    setConfirmBulkArchive(false);
    try {
      const res = await fetch(`/api/super-admin/invoices/bulk-${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds }),
      });
      if (!res.ok) {
        throw new Error(await readError(res));
      }
      const data: { processed?: string[]; rejected?: Array<{ invoiceId: string; reason: string }> } =
        await res.json();
      const skipped = (data.rejected ?? []).map((r) => ({
        invoiceNumber:
          invoices.find((invoice) => invoice.invoiceId === r.invoiceId)?.invoiceNumber ??
          r.invoiceId,
        reason: r.reason,
      }));
      setBulkResult({ kind, ok: (data.processed ?? []).length, skipped });
      setSelectedIds([]);
      setInvSkip(0);
      void fetchInvoices();
    } catch (err) {
      setBulkError(getErrorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  function openPackagePreview() {
    setConfirmPackage(false);
    setPackageOpen(true);
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
    setSelectedIds([]);
  }

  const invTotalPages = Math.max(1, Math.ceil(invTotal / PAGE_SIZE));
  const invCurrentPage = Math.floor(invSkip / PAGE_SIZE) + 1;
  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerTotal / PAGE_SIZE));
  const ledgerCurrentPage = Math.floor(ledgerSkip / PAGE_SIZE) + 1;

  return (
    <>
      <div className={`min-h-screen bg-gray-50 ${packageOpen ? 'print:hidden' : ''}`}>
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
                  setSelectedIds([]);
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
                  setSelectedIds([]);
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

          {/* ── Bulk result + selection toolbar (bulk-invoice audit Phases A–C) ── */}
          {!invLoading && !invError && bulkError && (
            <FinancialExceptionBanner
              title="Bulk action failed"
              exceptions={[bulkError]}
              onDismiss={() => setBulkError(null)}
            />
          )}
          {!invLoading && !invError && bulkResult && (
            <div className="print-hide rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {bulkResult.ok} invoice{bulkResult.ok === 1 ? '' : 's'}{' '}
                    {bulkResult.kind === 'issue' ? 'issued' : 'archived'} successfully.
                    {bulkResult.skipped.length > 0
                      ? ` ${bulkResult.skipped.length} were not changed.`
                      : ''}
                  </p>
                  {bulkResult.skipped.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                      {bulkResult.skipped.map((skip) => (
                        <li key={skip.invoiceNumber}>
                          {skip.invoiceNumber} — {skip.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBulkResult(null)}
                  className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {selectedIds.length > 0 && !invLoading && !invError && (
            <div className="print-hide rounded-xl border border-primary/30 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
                  </p>
                  <p className="text-xs text-gray-500">
                    Total{' '}
                    {formatCurrency(selected.reduce((s, invoice) => s + invoice.totalAmount, 0))}
                    {distinctOrgCount(selected) > 1
                      ? ' — multiple organizations selected'
                      : ` — ${orgNameOf(selected[0].tenantId)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {issuePlan.eligible.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmBulkIssue(true)}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Issue {issuePlan.eligible.length}
                    </button>
                  )}
                  {archivePlan.eligible.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setConfirmBulkArchive(true)}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" />
                      Archive {archivePlan.eligible.length}
                    </button>
                  )}
                  {packagePlan.ok && (
                    <button
                      type="button"
                      onClick={() => setConfirmPackage(true)}
                      disabled={bulkBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Printer className="h-4 w-4" />
                      Download PDF package
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedIds(deselectPageInvoices(visibleIds, selectedIds))}
                    disabled={bulkBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              </div>
              {(issuePlan.ineligible.length > 0 || archivePlan.ineligible.length > 0) && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Some selected invoices cannot take every action — each action re-validates every
                  invoice and skips the ones it does not apply to. Details are shown before you
                  confirm.
                </p>
              )}
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
                    <th className="print-hide w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all invoices on this page"
                        checked={pageFullySelected}
                        onChange={() =>
                          setSelectedIds((current) =>
                            pageFullySelected
                              ? deselectPageInvoices(visibleIds, current)
                              : selectPageInvoices(visibleIds, current),
                          )
                        }
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </th>
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
                      <td className="print-hide px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select invoice ${invoice.invoiceNumber}`}
                          checked={selectedIds.includes(invoice.invoiceId)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              toggleInvoiceSelection(current, invoice.invoiceId),
                            )
                          }
                          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                        />
                      </td>
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

      {/* ── Bulk confirmations — show exactly what will happen before it does ── */}
      {confirmBulkIssue && (
        <ConfirmDialog
          title="Issue invoices?"
          confirmLabel={`Issue ${issuePlan.eligible.length}`}
          busy={bulkBusy}
          onConfirm={() =>
            runBulkTransition(
              'issue',
              issuePlan.eligible.map((invoice) => invoice.invoiceId),
            )
          }
          onCancel={() => setConfirmBulkIssue(false)}
        >
          <p>
            {issuePlan.eligible.length} invoice{issuePlan.eligible.length === 1 ? '' : 's'} will
            move from “Ready to Send” to “Awaiting Organization Payment”.
          </p>
          <p>
            Total{' '}
            {formatCurrency(issuePlan.eligible.reduce((s, invoice) => s + invoice.totalAmount, 0))}
            {distinctOrgCount(issuePlan.eligible) === 1
              ? ` — ${orgNameOf(issuePlan.eligible[0].tenantId)}`
              : ' — multiple organizations'}
          </p>
          {issuePlan.ineligible.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">
                {issuePlan.ineligible.length} selected invoice
                {issuePlan.ineligible.length === 1 ? '' : 's'} cannot be issued and will not change:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {issuePlan.ineligible.map(({ invoice, reason }) => (
                  <li key={invoice.invoiceId}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </ConfirmDialog>
      )}
      {confirmBulkArchive && (
        <ConfirmDialog
          title="Archive invoices?"
          confirmLabel={`Archive ${archivePlan.eligible.length}`}
          busy={bulkBusy}
          onConfirm={() =>
            runBulkTransition(
              'archive',
              archivePlan.eligible.map((invoice) => invoice.invoiceId),
            )
          }
          onCancel={() => setConfirmBulkArchive(false)}
        >
          <p>
            {archivePlan.eligible.length} paid invoice
            {archivePlan.eligible.length === 1 ? '' : 's'} will move to “Closed”. Archiving does not
            change any amounts.
          </p>
          <p>
            Total{' '}
            {formatCurrency(archivePlan.eligible.reduce((s, invoice) => s + invoice.totalAmount, 0))}
            {distinctOrgCount(archivePlan.eligible) === 1
              ? ` — ${orgNameOf(archivePlan.eligible[0].tenantId)}`
              : ' — multiple organizations'}
          </p>
          {archivePlan.ineligible.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-semibold">
                {archivePlan.ineligible.length} selected invoice
                {archivePlan.ineligible.length === 1 ? '' : 's'} cannot be archived and will not
                change:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {archivePlan.ineligible.map(({ invoice, reason }) => (
                  <li key={invoice.invoiceId}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </ConfirmDialog>
      )}
      {confirmPackage && packagePlan.ok && (
        <ConfirmDialog
          title="Create invoice package?"
          confirmLabel="Create PDF package"
          onConfirm={openPackagePreview}
          onCancel={() => setConfirmPackage(false)}
        >
          <p>
            <span className="font-semibold text-gray-900">Organization:</span>{' '}
            {orgNameOf(packagePlan.orgId ?? '')}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Invoices:</span>{' '}
            {packagePlan.invoices.length}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Total:</span>{' '}
            {formatCurrency(packagePlan.total)}
          </p>
          <p>
            <span className="font-semibold text-gray-900">Documents:</span>{' '}
            {packagePlan.invoices.length} invoice
            {packagePlan.invoices.length === 1 ? '' : 's'} plus a cover page — one page per invoice.
          </p>
          <p className="text-xs text-gray-500">
            The package is a delivery document only. It does not change any invoice status.
          </p>
        </ConfirmDialog>
      )}

      {/* ── Package preview overlay ────────────────────────────────────────────
          A sibling of the page root: the root carries print:hidden while the
          package is open, so the printable package must live outside it for
          window.print() to emit only the package documents. */}
      {packageOpen && packagePlan.ok && (
        <div className="fixed inset-0 z-50 overflow-auto bg-gray-100 p-4 print:static print:bg-white print:p-0">
          <div className="print-hide mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-gray-900">Invoice package ready</p>
              <p className="text-xs text-gray-500">
                {packagePlan.invoices.length} invoice{packagePlan.invoices.length === 1 ? '' : 's'} for{' '}
                {orgNameOf(packagePlan.orgId ?? '')} · Total {formatCurrency(packagePlan.total)} —
                choose “Save as PDF” in the print dialog.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Printer className="h-4 w-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => setPackageOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-4xl space-y-6">
            <PrintableInvoicePackage
              orgName={orgNameOf(packagePlan.orgId ?? '')}
              tenantId={packagePlan.orgId ?? ''}
              generatedAt={new Date().toISOString()}
              invoices={selected.map((invoice) => ({
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status,
                tenantId: invoice.tenantId,
                orgName: orgNameOf(invoice.tenantId),
                period: invoice.period,
                generatedAt: invoice.generatedAt,
                issuedAt: invoice.issuedAt,
                paidAt: invoice.paidAt,
                totalAmount: invoice.totalAmount,
                lineItems: invoice.lineItems,
              }))}
            />
          </div>
        </div>
      )}
    </>
  );
}
