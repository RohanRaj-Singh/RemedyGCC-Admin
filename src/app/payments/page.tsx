'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, Banknote, RefreshCw, ChevronDown, ChevronRight,
  Wallet, Landmark, AlertTriangle, Download, Clock, Search, FileText,
} from 'lucide-react';
import WorkflowStepper from '@/components/financial/WorkflowStepper';
import SuccessBanner from '@/components/financial/SuccessBanner';

// ── Types (org-first Payment Operations workspace) ─────────────────────────

interface WorkspaceClaim {
  reimbursementId: string;
  claimNumber?: string;
  employeeName: string;
  amount: number;
  serviceDate?: string;
  queuedAt: string;
  /** Funding invoice (set when the claim was auto-queued by `markInvoicePaid`). */
  invoiceId?: string;
  invoiceNumber?: string;
  /** Claim's immutable bank snapshot — the source of truth for payouts. */
  bankAccountNumber?: string;
  bankName?: string;
  /** Effective bank after legacy fallback resolution. */
  effectiveBankAccountNumber?: string;
  effectiveBankName?: string;
  bankSource?: 'claim' | 'employee_fallback' | 'missing';
}

interface WorkspaceClinic {
  clinicId: string | null;
  clinicName: string | null;
  totalAmount: number;
  count: number;
  claims: WorkspaceClaim[];
}

interface WorkspaceOrg {
  tenantId: string;
  tenantName: string;
  totalOutstanding: number;
  lastPaymentDate: string | null;
  clinics: WorkspaceClinic[];
}

interface HistoryEntry {
  paymentRecordId: string;
  claimId: string;
  claimNumber?: string;
  /** Invoice that funded this payout (linked when auto-queued by `markInvoicePaid`). */
  invoiceId?: string;
  invoiceNumber?: string;
  tenantName: string;
  clinicName: string | null;
  amount: number;
  paymentReference?: string;
  bankReference?: string;
  paidAt?: string;
  paidBy?: string;
  status: 'to_be_paid' | 'paid';
}

interface WorkspaceResponse {
  summary: {
    outstanding: { count: number; amount: number };
    overdue: { count: number; amount: number };
    paidToday: { count: number; amount: number };
  };
  organizations: WorkspaceOrg[];
  paymentHistory: HistoryEntry[];
}

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

/**
 * Payout readiness is judged from the CLAIM's bank snapshot (with legacy
 * fallback to the employee profile already resolved server-side into
 * `effectiveBank*`/`bankSource`). The clinic directory is used only for the
 * display name — never for payout readiness.
 */
function claimBankReady(claim: WorkspaceClaim): boolean {
  return Boolean(
    claim.effectiveBankAccountNumber?.trim() && claim.effectiveBankName?.trim(),
  );
}

export default function PaymentsPage() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<{ href: string; label: string } | null>(null);
  // Optional bank/transfer reference recorded on each payout for reconciliation.
  const [payoutBankRef, setPayoutBankRef] = useState('');

  // Progressive disclosure state.
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null);

  // History tab toggle.
  const [showHistory, setShowHistory] = useState(false);

  // Filters.
  const [tenantFilter, setTenantFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tenantFilter) params.set('tenantId', tenantFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';

      const workspaceRes = await fetch(`/api/super-admin/payments/operations${suffix}`);
      if (!workspaceRes.ok) throw new Error('Failed to load the payment workspace.');
      const workspace: WorkspaceResponse = await workspaceRes.json();
      setData(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  useEffect(() => { load(); }, [load]);

  /** Aggregate per-org: ready (bank complete), blocked (bank missing), overdue. */
  const orgMetrics = useMemo(() => {
    const now = Date.now();
    const OVERDUE_MS = 14 * 86400000;
    const byOrg = new Map<string, {
      ready: { count: number; amount: number };
      blocked: { count: number; amount: number };
      overdue: { count: number; amount: number };
    }>();

    for (const org of data?.organizations ?? []) {
      byOrg.set(org.tenantId, { ready: { count: 0, amount: 0 }, blocked: { count: 0, amount: 0 }, overdue: { count: 0, amount: 0 } });
    }

    for (const org of data?.organizations ?? []) {
      const m = byOrg.get(org.tenantId)!;
      for (const clinic of org.clinics) {
        for (const claim of clinic.claims) {
          // Readiness comes from the claim's bank snapshot (with legacy fallback
          // already resolved server-side). Never from the clinic directory.
          if (claimBankReady(claim)) { m.ready.count += 1; m.ready.amount += claim.amount; }
          else { m.blocked.count += 1; m.blocked.amount += claim.amount; }
          if (now - new Date(claim.queuedAt).getTime() > OVERDUE_MS) {
            m.overdue.count += 1; m.overdue.amount += claim.amount;
          }
        }
      }
    }
    return byOrg;
  }, [data]);

  // Global KPI rollups.
  const kpis = useMemo(() => {
    let ready = { count: 0, amount: 0 };
    let blocked = { count: 0, amount: 0 };
    for (const [orgId, m] of orgMetrics) {
      ready = { count: ready.count + m.ready.count, amount: ready.amount + m.ready.amount };
      blocked = { count: blocked.count + m.blocked.count, amount: blocked.amount + m.blocked.amount };
    }
    return {
      readyToday: ready,
      outstanding: data?.summary.outstanding ?? { count: 0, amount: 0 },
      blocked,
      overdue: data?.summary.overdue ?? { count: 0, amount: 0 },
      paidToday: data?.summary.paidToday ?? { count: 0, amount: 0 },
    };
  }, [data, orgMetrics]);

  /** Filtered org list (by tenant + search). */
  const visibleOrgs = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return (data?.organizations ?? []).filter((org) => {
      const matchesTenant = tenantFilter ? org.tenantId === tenantFilter : true;
      const matchesSearch = query
        ? org.tenantName.toLowerCase().includes(query)
          || org.clinics.some((c) => c.clinicName?.toLowerCase().includes(query))
        : true;
      return matchesTenant && matchesSearch;
    });
  }, [data, tenantFilter, searchFilter]);

  /** Collect every queued claim across the visible orgs for bulk "pay all ready". */
  const readyClaimIds = useMemo(() => {
    const ids: string[] = [];
    for (const org of visibleOrgs) {
      const m = orgMetrics.get(org.tenantId)!;
      if (m.ready.count === 0) continue;
      for (const clinic of org.clinics) {
        for (const claim of clinic.claims) {
          if (claimBankReady(claim)) ids.push(claim.reimbursementId);
        }
      }
    }
    return ids;
  }, [visibleOrgs, orgMetrics]);

  const processAllReady = async () => {
    if (readyClaimIds.length === 0) return;
    setProcessing(true);
    setError(null);
    setSuccess(null);
    setSuccessLink(null);
    try {
      const res = await fetch('/api/super-admin/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimIds: readyClaimIds,
          ...(payoutBankRef.trim() ? { bankReference: payoutBankRef.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Payout failed.');
      }
      const dataRes = await res.json();
      setSuccess(`${dataRes.processed} claim${dataRes.processed === 1 ? '' : 's'} paid successfully. Financial workflow complete for these claims.`);
      setSuccessLink({ href: '/invoices', label: 'Back to Invoices' });
      setExpandedOrg(null);
      setExpandedClinic(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  const exportOrgsCsv = () => {
    if (!data) return;
    const header = ['Organization', 'Outstanding', 'Ready Today', 'Blocked', 'Overdue', 'Last Payment'];
    const rows = (data.organizations ?? []).map((org) => {
      const m = orgMetrics.get(org.tenantId)!;
      return [
        org.tenantName,
        org.totalOutstanding.toFixed(3),
        m.ready.amount.toFixed(3),
        m.blocked.amount.toFixed(3),
        m.overdue.amount.toFixed(3),
        org.lastPaymentDate ? new Date(org.lastPaymentDate).toISOString().slice(0, 10) : '',
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCsv(csv, 'payment-operations-orgs.csv');
  };

  const exportHistoryCsv = () => {
    if (!data) return;
    const header = ['Payment Ref', 'Claim #', 'Invoice', 'Tenant', 'Clinic', 'Amount', 'Paid Date', 'Paid By', 'Bank Ref'];
    const rows = (data.paymentHistory ?? []).map((h) => [
      h.paymentReference ?? '', h.claimNumber ?? '', h.invoiceNumber ?? '', h.tenantName, h.clinicName ?? '',
      h.amount.toFixed(3), h.paidAt ? new Date(h.paidAt).toISOString() : '', h.paidBy ?? '', h.bankReference ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadCsv(csv, 'payment-history.csv');
  };

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

  const hasQueue = (data?.organizations.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                <Wallet className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Operations</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Clinic payouts — who we owe, how much, and what is ready to pay today.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowHistory(!showHistory)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                {showHistory ? 'Back to Queue' : 'Payment History'}
              </button>
              <button onClick={load} disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <WorkflowStepper current="payments" />

        {/* KPIs — actionable, today-first */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Ready to Pay Today</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{formatCurrency(kpis.readyToday.amount)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{kpis.readyToday.count} claims · bank verified</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-blue-800">{formatCurrency(kpis.outstanding.amount)}</p>
              <p className="text-xs text-blue-600 mt-0.5">{kpis.outstanding.count} queued claims</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Blocked</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{formatCurrency(kpis.blocked.amount)}</p>
              <p className="text-xs text-amber-600 mt-0.5">{kpis.blocked.count} missing bank info</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Overdue ({'>'}14d)</p>
              <p className="mt-1 text-2xl font-bold text-red-800">{formatCurrency(kpis.overdue.amount)}</p>
              <p className="text-xs text-red-600 mt-0.5">{kpis.overdue.count} claims</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Paid Today</p>
              <p className="mt-1 text-2xl font-bold text-purple-800">{formatCurrency(kpis.paidToday.amount)}</p>
              <p className="text-xs text-purple-600 mt-0.5">{kpis.paidToday.count} claims</p>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <SuccessBanner message={success} action={successLink} />
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && !error && showHistory ? (
          /* ── Payment History (lightweight reconciliation trail) ── */
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Payment History</h2>
              <button onClick={exportHistoryCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
            {(data?.paymentHistory.length ?? 0) === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No payments recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 font-semibold text-gray-600">Payment Ref</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Bank Ref</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Claim #</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Invoice</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Tenant</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Clinic</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Paid Date</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Paid By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.paymentHistory ?? []).map((h) => (
                      <tr key={h.paymentRecordId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {h.paymentReference ? (
                            <a href={`/payments/${h.claimId}`}
                              className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800"
                              title="Open payment detail">
                              {h.paymentReference}
                            </a>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-gray-900">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{h.bankReference ?? '—'}</td>
                        <td className="px-4 py-3">
                          {h.claimNumber ? (
                            <a href={`/reimbursements/${h.claimId}`}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800"
                              title="Open claim">
                              {h.claimNumber}
                            </a>
                          ) : (
                            <span className="font-mono text-xs text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {h.invoiceNumber ? (
                            <a
                              href={`/invoices/${h.invoiceId}`}
                              className="inline-flex items-center gap-1 font-mono text-xs font-medium text-blue-600 hover:text-blue-800"
                              title={`Open invoice ${h.invoiceNumber}`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              {h.invoiceNumber}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{h.tenantName}</td>
                        <td className="px-4 py-3 text-gray-700">{h.clinicName ?? '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(h.amount)}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(h.paidAt)}</td>
                        <td className="px-4 py-3 text-gray-500">{h.paidBy ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : !loading && !error && (
          /* ── Organization-first workspace ── */
          <>
            {/* Filters + actions */}
            <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex-1 min-w-55">
                <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Organization or clinic..." value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm placeholder-gray-400" />
                </div>
              </div>
              <div className="flex-1 min-w-45">
                <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
                <select value={tenantFilter} onChange={(e) => { setTenantFilter(e.target.value); setExpandedOrg(null); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">All Organizations</option>
                  {(data?.organizations ?? []).map((org) => (
                    <option key={org.tenantId} value={org.tenantId}>{org.tenantName}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={exportOrgsCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  <Download className="h-4 w-4" /> Export Orgs
                </button>
              </div>
            </div>

            {hasQueue && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-emerald-800">
                    {kpis.readyToday.count} claim{kpis.readyToday.count === 1 ? '' : 's'} ready to pay today ({formatCurrency(kpis.readyToday.amount)})
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={payoutBankRef}
                      onChange={(e) => setPayoutBankRef(e.target.value)}
                      placeholder="Bank/transfer ref (optional)"
                      title="Recorded on each payout for reconciliation"
                      className="w-52 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    />
                    <button onClick={processAllReady} disabled={processing || readyClaimIds.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                      <Banknote className="h-4 w-4" />
                      {processing ? 'Processing...' : 'Pay Ready Today'}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-emerald-700">
                  Bank reference is stored on each payment record for reconciliation (shown in Payment History export).
                </p>
              </div>
            )}

            {visibleOrgs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No claims queued for payment</p>
                <p className="text-sm text-gray-400 mt-1">
                  Approved claims enter the queue when an organization pays Remedy, or when queued for payout.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleOrgs.map((org) => {
                  const m = orgMetrics.get(org.tenantId)!;
                  const isOpen = expandedOrg === org.tenantId;
                  return (
                    <div key={org.tenantId} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      {/* Org row */}
                      <div className="px-5 py-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          setExpandedOrg(isOpen ? null : org.tenantId);
                          setExpandedClinic(null);
                        }}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                            <Landmark className="h-4 w-4 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{org.tenantName}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {org.clinics.reduce((s, c) => s + c.count, 0)} claims · last payment {formatDate(org.lastPaymentDate)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Outstanding</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(org.totalOutstanding)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Ready Today</p>
                              <p className="font-semibold text-emerald-600">{formatCurrency(m.ready.amount)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-400">Blocked</p>
                              <p className={`font-semibold ${m.blocked.count > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{formatCurrency(m.blocked.amount)}</p>
                            </div>
                            {m.overdue.count > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                                <AlertTriangle className="h-3 w-3" /> {m.overdue.count} overdue
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Clinic drill-down */}
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-4 space-y-3">
                          {org.clinics.map((clinic) => {
                            const clinicIsOpen = expandedClinic === `${org.tenantId}::${clinic.clinicId ?? '__no_clinic__'}`;
                            const readyCount = clinic.claims.filter((c) => claimBankReady(c)).length;
                            const readyAmount = clinic.claims.filter((c) => claimBankReady(c)).reduce((s, c) => s + c.amount, 0);
                            const allReady = clinic.claims.length > 0 && readyCount === clinic.claims.length;
                            const hasFallback = clinic.claims.some((c) => c.bankSource === 'employee_fallback');
                            const effectiveBank = clinic.claims.find((c) => c.effectiveBankName)?.effectiveBankName;
                            return (
                              <div key={`${org.tenantId}::${clinic.clinicId ?? '__no_clinic__'}`} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                                  onClick={() => setExpandedClinic(clinicIsOpen ? null : `${org.tenantId}::${clinic.clinicId ?? '__no_clinic__'}`)}>
                                  <div className="flex items-center gap-3 min-w-0">
                                    {clinicIsOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                                    <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${allReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                      title={allReady ? 'All claims have payout bank details' : 'Some claims are missing payout bank details'} />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-gray-900">{clinic.clinicName ?? 'No Clinic'}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {clinic.count} claims · {formatCurrency(clinic.totalAmount)}
                                        {' · '}{readyCount} ready ({formatCurrency(readyAmount)})
                                        {hasFallback && <span className="ml-2 text-sky-600">· legacy fallback</span>}
                                        {!allReady && <span className="ml-2 text-amber-600">· missing bank details</span>}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="text-right">
                                      <p className="text-xs text-gray-400">Bank (claim)</p>
                                      <p className="text-xs text-gray-600">{effectiveBank || '—'}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); }}
                                      className={`text-xs font-medium ${allReady ? 'text-emerald-600' : 'text-amber-600'} hover:underline`}>
                                      {allReady ? 'Ready' : `${clinic.claims.length - readyCount} need bank info`}
                                    </button>
                                  </div>
                                </div>
                                {clinicIsOpen && (
                                  <div className="border-t border-gray-100 px-4 py-3">
                                    <ul className="space-y-1.5">
                                      {clinic.claims.map((claim) => (
                                        <li key={claim.reimbursementId} className="flex items-center justify-between gap-3 text-sm">
                                          <a href={`/reimbursements/${claim.reimbursementId}`}
                                            className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 truncate">
                                            {claim.claimNumber ?? claim.reimbursementId}
                                          </a>
                                          <span className="text-xs text-gray-500 hidden sm:inline">{claim.employeeName}</span>
                                          <span className={`text-[11px] shrink-0 ${claimBankReady(claim) ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {claim.bankSource === 'employee_fallback' ? 'profile fallback' : claimBankReady(claim) ? 'bank ok' : 'no bank'}
                                          </span>
                                          {claim.invoiceNumber && (
                                            <a href={`/invoices/${claim.invoiceId}`}
                                              className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-blue-600 hover:text-blue-800 shrink-0"
                                              title={`Funded by invoice ${claim.invoiceNumber}`}>
                                              <FileText className="h-3 w-3" />
                                              {claim.invoiceNumber}
                                            </a>
                                          )}
                                          <span className="font-medium text-gray-900 shrink-0">{formatCurrency(claim.amount)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
