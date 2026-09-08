'use client';

// ── Payments workspace (Phase 4 rebuild) ────────────────────────────────────
// Claim/payment-centered workspace with three primary views:
//   READY TO PAY · BLOCKED · PAID (history)
// The actionable unit is the claim; organization and clinic are context,
// filters, and grouping — not the unit of action.
//
// Separation of concerns:
//   - Pure logic (flatten / classify / group / filter / payload / CSV) lives in
//     `@/lib/financial/payout` (framework-free, unit-tested).
//   - This page owns data fetching, view state, selection, and recording.
//   - Presentational pieces (tables, groups) are small module-level helpers.

import { useState, useEffect, useCallback, useMemo } from 'react';
  import {
    Wallet, RefreshCw, Search, Download, Banknote, AlertTriangle, Landmark,
    Clock, LayoutList, LayoutGrid,
  } from 'lucide-react';
import WorkflowStepper from '@/components/financial/WorkflowStepper';
import FinancialWorkflowHeader from '@/components/financial/FinancialWorkflowHeader';
import FinancialSummaryCards from '@/components/financial/FinancialSummaryCards';
import FinancialRecordLink from '@/components/financial/FinancialRecordLink';
import FinancialEmptyState from '@/components/financial/FinancialEmptyState';
import FinancialExceptionBanner from '@/components/financial/FinancialExceptionBanner';
import SuccessBanner from '@/components/financial/SuccessBanner';
import { FinancialSummarySkeleton, FinancialTableSkeleton } from '@/components/financial/FinancialSkeleton';
import PaymentRecordDialog, {
  type PaymentRecordClaim, type PaymentRecordFields,
} from '@/components/financial/PaymentRecordDialog';
import {
  flattenQueue, classifyPayout, partitionByPayoutStatus, summarizePayouts, groupByClinic, buildPaymentPayload,
  filterPayoutClaims, buildPayoutCsv, buildHistoryCsv, daysQueued,
  type WorkspaceOrg, type PayoutClaim, type PayoutHistoryEntry, type ClinicGroup,
} from '@/lib/financial/payout';
import { formatCurrency, formatDate } from '@/lib/financial/format';

// ── Response shape (mirror of `listPaymentOperations`) ──────────────────────

interface HistoryEntry {
  paymentRecordId: string;
  claimId: string;
  claimNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  tenantName: string;
  clinicName: string | null;
  amount: number;
  paymentReference?: string;
  bankReference?: string;
  paidAt?: string;
  paymentDate?: string;
  paidBy?: string;
  method?: string;
  status: 'to_be_paid' | 'paid';
}

interface WorkspaceResponse {
  summary: {
    outstanding: { count: number; amount: number };
    paidToday: { count: number; amount: number };
  };
  organizations: WorkspaceOrg[];
  paymentHistory: HistoryEntry[];
}

type Tab = 'ready' | 'blocked' | 'paid';

function maskAccount(account?: string) {
  if (!account) return '—';
  return `•••• ${account.slice(-4)}`;
}

/** Stable empty list used by lazy memoized groupings when groupView is off. */
const EMPTY_GROUPS: ClinicGroup[] = [];

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // View state.
  const [tab, setTab] = useState<Tab>('ready');
  const [query, setQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [groupView, setGroupView] = useState(false);

  // Selection state.
  const [dialogClaims, setDialogClaims] = useState<PaymentRecordClaim[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/payments/operations');
      if (!res.ok) throw new Error('Failed to load the payment workspace.');
      const workspace: WorkspaceResponse = await res.json();
      setData(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Prepared data (pure) ─────────────────────────────────────────────────

  const allClaims = useMemo(() => flattenQueue(data?.organizations ?? []), [data]);
  const paidClaimIds = useMemo(
    () => new Set((data?.paymentHistory ?? []).map((h) => h.claimId)),
    [data],
  );

  const filteredClaims = useMemo(
    () => filterPayoutClaims(allClaims, { query, orgId: orgFilter || undefined }),
    [allClaims, query, orgFilter],
  );
  // PA2-A item 6: single-pass partition — replaces two redundant
  // `filteredClaims.filter(...)` walks and `classifyPayout` calls.
  const { ready: readyClaims, blocked: blockedClaims } = useMemo(
    () => partitionByPayoutStatus(filteredClaims),
    [filteredClaims],
  );

  const totals = useMemo(() => summarizePayouts(allClaims), [allClaims]);

  const orgOptions = useMemo(() => data?.organizations ?? [], [data]);

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.paymentHistory ?? []).filter((h) => {
      if (!q) return true;
      return [h.tenantName, h.clinicName, h.claimNumber, h.invoiceNumber, h.paymentReference, h.bankReference]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [data, query]);

  // ── Recording ─────────────────────────────────────────────────────────────

  const openDialog = (claims: PayoutClaim[]) => {
    setDialogClaims(claims.map((c) => ({
      claimId: c.claimId,
      claimNumber: c.claimNumber,
      employeeName: c.employeeName,
      orgName: c.orgName,
      clinicName: c.clinicName,
      amount: c.amount,
      effectiveBankAccountNumber: c.bankAccountNumber,
      effectiveBankName: c.bankName,
      invoiceId: c.invoiceId,
      invoiceNumber: c.invoiceNumber,
      serviceDate: c.serviceDate,
    })));
  };

  const closeDialog = () => setDialogClaims(null);

  const handleRecordConfirm = async (fields: PaymentRecordFields) => {
    if (!dialogClaims || dialogClaims.length === 0) return;
    try {
      const payload = buildPaymentPayload(dialogClaims.map((c) => c.claimId), fields);
      const res = await fetch('/api/super-admin/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Recording failed.');
      }
      const result = await res.json();
      const n = result.processed as number;
      setSuccess(`${n} claim${n === 1 ? '' : 's'} recorded as paid. Payment ledger updated.`);
      setDialogClaims(null);
      await load();
    } catch (err) {
      throw err instanceof Error ? err : new Error('Recording failed.');
    }
  };

  // ── Export (CSV via the pure module) ──────────────────────────────────────

  const exportReadyCsv = () => {
    if (readyClaims.length === 0) return;
    downloadCsv(buildPayoutCsv(readyClaims), 'payments-ready.csv');
  };

  const exportHistoryCsv = () => {
    if (!data) return;
    const history: PayoutHistoryEntry[] = filteredHistory.map((h) => ({
      claimId: h.claimId,
      claimNumber: h.claimNumber,
      invoiceId: h.invoiceId,
      invoiceNumber: h.invoiceNumber,
      orgName: h.tenantName,
      clinicName: h.clinicName,
      amount: h.amount,
      paymentReference: h.paymentReference,
      bankReference: h.bankReference,
      paidAt: h.paidAt,
      paymentDate: h.paymentDate,
      paidBy: h.paidBy,
      method: h.method,
    }));
    downloadCsv(buildHistoryCsv(history), 'payment-history.csv');
  };

  // ── Presentational helpers ────────────────────────────────────────────────

  // PA2-A item 6: group-by-clinic was previously computed unconditionally for
  // both Ready and Blocked even though only the active tab/group-view needs
  // it. Lazy it now — only the visible bucket when the operator has actually
  // asked for the grouped view. Saves two full O(n) walks per render.
  const readyGroups = useMemo(
    () => (groupView && tab === 'ready' ? groupByClinic(readyClaims) : EMPTY_GROUPS),
    [groupView, tab, readyClaims],
  );
  const blockedGroups = useMemo(
    () => (groupView && tab === 'blocked' ? groupByClinic(blockedClaims) : EMPTY_GROUPS),
    [groupView, tab, blockedClaims],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <FinancialWorkflowHeader
        icon={<Wallet className="h-6 w-6 text-primary" />}
        iconContainerClass="bg-emerald-100"
        title="Payments"
        subtitle="Clinic payouts — record what is ready, resolve what is blocked, reconcile what is paid."
        actions={
          <button onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <WorkflowStepper current="payments" />

        {/* KPIs — readiness-first */}
        {loading ? (
          <FinancialSummarySkeleton cards={4} />
        ) : !error ? (
          <FinancialSummaryCards
            cards={[
              { label: 'Ready to Pay', value: formatCurrency(totals.ready.amount), secondary: `${totals.ready.count} claims · bank verified`, tone: 'success', icon: <Banknote className="h-4 w-4" /> },
              { label: 'Blocked', value: formatCurrency(totals.blocked.amount), secondary: `${totals.blocked.count} missing bank details`, tone: 'warning', icon: <AlertTriangle className="h-4 w-4" /> },
              { label: 'Paid Today', value: formatCurrency(data?.summary.paidToday.amount ?? 0), secondary: `${data?.summary.paidToday.count ?? 0} claims`, tone: 'neutral', icon: <Landmark className="h-4 w-4" /> },
              { label: 'Outstanding', value: formatCurrency(data?.summary.outstanding.amount ?? 0), secondary: `${data?.summary.outstanding.count ?? 0} queued claims`, tone: 'info', icon: <Wallet className="h-4 w-4" /> },
            ]}
          />
        ) : null}

        {error && (
          <FinancialExceptionBanner
            title="Cannot load payment operations"
            exceptions={[error]}
            onDismiss={() => setError(null)}
          />
        )}
        {success && <SuccessBanner message={success} />}

        {/* Tabs */}
        <TabBar
          tab={tab}
          setTab={setTab}
          readyCount={readyClaims.length}
          blockedCount={blockedClaims.length}
          paidCount={filteredHistory.length}
        />

        {/* Toolbar — search / org filter / grouping (queue views only) */}
        {!loading && !error && tab !== 'paid' && (
          <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex-1 min-w-52">
              <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Employee, claim, invoice, clinic, org…" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400" />
              </div>
            </div>
            <div className="flex-1 min-w-44">
              <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
              <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                <option value="">All Organizations</option>
                {orgOptions.map((org) => (
                  <option key={org.tenantId} value={org.tenantId}>{org.tenantName}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setGroupView(!groupView)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
                  groupView ? 'border-primary/30 bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {groupView ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                {groupView ? 'List view' : 'Group by clinic'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <FinancialTableSkeleton rows={5} columns={7} />
        ) : error ? null : tab === 'paid' ? (
          <HistoryView history={filteredHistory} onExport={exportHistoryCsv} />
        ) : tab === 'ready' ? (
          <ReadyView
            claims={readyClaims}
            groups={readyGroups}
            groupView={groupView}
            onRecord={openDialog}
            onRecordAll={() => openDialog(readyClaims)}
            onExport={exportReadyCsv}
          />
        ) : (
          <BlockedView claims={blockedClaims} groups={blockedGroups} groupView={groupView} />
        )}
      </div>

      {/* Recording dialog */}
      <PaymentRecordDialog
        open={dialogClaims !== null}
        claims={dialogClaims ?? []}
        totalAmount={(dialogClaims ?? []).reduce((s, c) => s + c.amount, 0)}
        paidClaimIds={paidClaimIds}
        onConfirm={handleRecordConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}

// ── Presentational pieces ───────────────────────────────────────────────────

function TabBar({ tab, setTab, readyCount, blockedCount, paidCount }: {
  tab: Tab;
  setTab: (t: Tab) => void;
  readyCount: number;
  blockedCount: number;
  paidCount: number;
}) {
  const tabs: { key: Tab; label: string; count: number; tone: string }[] = [
    { key: 'ready', label: 'Ready to Pay', count: readyCount, tone: 'text-emerald-700 bg-emerald-50 ring-emerald-200' },
    { key: 'blocked', label: 'Blocked', count: blockedCount, tone: 'text-amber-700 bg-amber-50 ring-amber-200' },
    { key: 'paid', label: 'Paid (History)', count: paidCount, tone: 'text-slate-700 bg-slate-50 ring-slate-200' },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payment views">
      {tabs.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ring-1 ring-inset transition-colors ${
              active ? t.tone : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active ? 'bg-white/60' : 'bg-gray-100 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReadyView({ claims, groups, groupView, onRecord, onRecordAll, onExport }: {
  claims: PayoutClaim[];
  groups: ClinicGroup[];
  groupView: boolean;
  onRecord: (claims: PayoutClaim[]) => void;
  onRecordAll: () => void;
  onExport: () => void;
}) {
  if (claims.length === 0) {
    return (
      <FinancialEmptyState
        icon={<Banknote className="h-6 w-6" />}
        title="No claims ready to pay"
        description="Claims reach this queue only after their invoice has been marked paid by the organization. If you just issued invoices, record the organization payments first — the linked claims then move here for clinic payout."
        action={{ label: 'Record organization payments', onClick: () => { window.location.href = '/invoices?status=issued'; } }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            {claims.length} claim{claims.length === 1 ? '' : 's'} ready to record · {formatCurrency(claims.reduce((s, c) => s + c.amount, 0))}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            Bank details verified on each claim. Recording marks them <span className="font-semibold">paid</span> in the ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={onRecordAll} data-testid="bulk-record-button"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700">
            <Banknote className="h-4 w-4" />
            Record {claims.length} Payment{claims.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      {groupView ? (
        <ClinicGroupedList groups={groups} onRecord={onRecord} ready />
      ) : (
        <ClaimTable claims={claims} onRecord={onRecord} />
      )}
    </div>
  );
}

function BlockedView({ claims, groups, groupView }: {
  claims: PayoutClaim[];
  groups: ClinicGroup[];
  groupView: boolean;
}) {
  if (claims.length === 0) {
    return (
      <FinancialEmptyState
        icon={<AlertTriangle className="h-6 w-6" />}
        title="No blocked claims"
        description="Blocked claims are queued for payment but missing bank details on the claim. They cannot be paid until the bank snapshot is resolved."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">
          {claims.length} blocked claim{claims.length === 1 ? '' : 's'} · {formatCurrency(claims.reduce((s, c) => s + c.amount, 0))}
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Each claim below is missing bank details on the claim itself — it is never silently funded from another source.
        </p>
      </div>

      {groupView ? (
        <ClinicGroupedList groups={groups} onRecord={() => {}} ready={false} />
      ) : (
        <ClaimTable claims={claims} onRecord={null} />
      )}
    </div>
  );
}

function ClinicGroupedList({ groups, onRecord, ready }: {
  groups: ClinicGroup[];
  onRecord: (claims: PayoutClaim[]) => void;
  ready: boolean;
}) {
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.clinicId ?? '__no_clinic__'} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <p className="text-sm font-semibold text-gray-900">{g.clinicName ?? 'No Clinic'}</p>
              <span className="text-xs text-gray-500">{g.count} claim{g.count === 1 ? '' : 's'}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(g.totalAmount)}</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {g.claims.map((c) => (
              <li key={c.claimId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <ClaimLink c={c} />
                <span className="text-xs text-gray-500 truncate">{c.employeeName}</span>
                <span className="text-xs text-gray-500 truncate hidden sm:inline">{c.orgName}</span>
                <InvoiceLink c={c} />
                <span className="text-xs text-gray-500 truncate hidden sm:inline">{c.bankName ?? '—'} {maskAccount(c.bankAccountNumber)}</span>
                <span className="ml-auto text-sm font-semibold text-gray-900">{formatCurrency(c.amount)}</span>
                {ready ? (
                  <button onClick={() => onRecord([c])} data-testid={`record-button-${c.claimId}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700">
                    <Banknote className="h-3 w-3" /> Record
                  </button>
                ) : (
                  <span className="text-[11px] text-amber-600 shrink-0">Missing bank</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ClaimTable({ claims, onRecord }: { claims: PayoutClaim[]; onRecord: ((c: PayoutClaim[]) => void) | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 font-semibold text-gray-600">Claim #</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Employee</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Clinic</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Invoice</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Bank</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Queued</th>
              {onRecord && <th className="px-4 py-3 font-semibold text-gray-600 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.claimId} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3"><ClaimLink c={c} /></td>
                <td className="px-4 py-3 text-gray-700">{c.employeeName}</td>
                <td className="px-4 py-3 text-gray-700">{c.orgName}</td>
                <td className="px-4 py-3 text-gray-700">{c.clinicName ?? '—'}</td>
                <td className="px-4 py-3"><InvoiceLink c={c} /></td>
                <td className="px-4 py-3 text-gray-700">
                  {c.bankName ?? '—'} <span className="text-gray-400 font-mono text-xs">{maskAccount(c.bankAccountNumber)}</span>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900 text-right">{formatCurrency(c.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{daysQueued(c.queuedAt)}d</td>
                {onRecord && (
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onRecord([c])} data-testid={`record-button-${c.claimId}`}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700">
                      <Banknote className="h-3 w-3" /> Record
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimLink({ c }: { c: PayoutClaim }) {
  return (
    <a href={`/reimbursements/${c.claimId}`} className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800"
      title="Open claim">
      {c.claimNumber ?? c.claimId}
    </a>
  );
}

function InvoiceLink({ c }: { c: PayoutClaim }) {
  return (
    <FinancialRecordLink
      kind="invoice"
      href={c.invoiceId ? `/invoices/${c.invoiceId}` : undefined}
      reference={c.invoiceNumber}
    />
  );
}

function HistoryView({ history, onExport }: { history: HistoryEntry[]; onExport: () => void }) {
  if (history.length === 0) {
    return (
      <FinancialEmptyState
        icon={<Clock className="h-6 w-6" />}
        title="No payments recorded yet"
        description="Recorded payouts appear here for reconciliation, with the payment reference, bank reference, method, and paid date."
      />
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">Payment History</h2>
        <button onClick={onExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 font-semibold text-gray-600">Payment Ref</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Claim #</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Invoice</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Clinic</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Amount</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Paid Date</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Method</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Paid By</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.paymentRecordId} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={`/payments/${h.claimId}`} className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800" title="Open payment detail">
                    {h.paymentReference ?? '—'}
                  </a>
                </td>
                <td className="px-4 py-3">
                  {h.claimNumber ? (
                    <a href={`/reimbursements/${h.claimId}`} className="font-mono text-xs text-blue-600 hover:text-blue-800" title="Open claim">
                      {h.claimNumber}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <FinancialRecordLink
                    kind="invoice"
                    href={h.invoiceId ? `/invoices/${h.invoiceId}` : undefined}
                    reference={h.invoiceNumber}
                  />
                </td>
                <td className="px-4 py-3 text-gray-900">{h.tenantName}</td>
                <td className="px-4 py-3 text-gray-700">{h.clinicName ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900 text-right">{formatCurrency(h.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(h.paymentDate ?? h.paidAt)}</td>
                <td className="px-4 py-3 text-gray-500">{h.method ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{h.paidBy ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
