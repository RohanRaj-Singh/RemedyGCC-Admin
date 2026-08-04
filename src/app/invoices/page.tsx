'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Search, AlertCircle, Plus, FileSpreadsheet, Download, Send, CheckCircle2,
  Eye, BarChart3, Clock, DollarSign, Archive, ChevronLeft,
} from 'lucide-react';
import WorkflowStepper from '@/components/financial/WorkflowStepper';
import SuccessBanner from '@/components/financial/SuccessBanner';

// ── A/R lifecycle (approved: draft → issued → paid → archived) ─────────────
type ArStatus = 'draft' | 'generated' | 'issued' | 'paid' | 'archived';

// Raw invoice shape returned by the Tenant App `/api/invoices` list.
interface ArInvoice {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  period: { from: string; to: string };
  status: ArStatus;
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: Array<{ claimId: string; claimNumber?: string; clinicName?: string; amount: number; sessionCount?: number; serviceDate?: string }>;
}

// Organization-level A/R summary from the ledger endpoint.
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

interface TenantOption {
  /** The tenants API returns `id` (equal to the tenantId used everywhere else). */
  id: string;
  name: string;
  slug: string;
}

const PAGE_SIZE = 20;

const AR_STATUS_CONFIG: Record<ArStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  generated: { label: 'Generated', color: 'bg-blue-100 text-blue-700' },
  issued: { label: 'Issued', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-600' },
};

const PAYMENT_STATUS_CONFIG: Record<string, string> = {
  '': 'All Status',
  issued: 'Issued (Owed)',
  paid: 'Paid',
  draft: 'Draft',
  archived: 'Archived',
};

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

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

/** Format a Date as a local `YYYY-MM-DD` for `<input type="date">`. */
function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfCurrentMonth(): string {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayDate(): string {
  return toDateInput(new Date());
}

// Invoice-level financial timeline (approved: Draft → Issued → Paid → Archived).
function InvoiceTimeline({ invoice }: { invoice: ArInvoice }) {
  const steps: { label: string; date?: string; done: boolean }[] = [
    { label: 'Draft', date: invoice.generatedAt, done: true },
    { label: 'Issued', date: invoice.issuedAt, done: invoice.status === 'issued' || invoice.status === 'paid' || invoice.status === 'archived' },
    { label: 'Paid', date: invoice.paidAt, done: invoice.status === 'paid' || invoice.status === 'archived' },
    { label: 'Archived', date: invoice.status === 'archived' ? invoice.paidAt : undefined, done: invoice.status === 'archived' },
  ];
  return (
    <div className="space-y-1.5">
      {steps.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-gray-200'}`} />
          <span className={`text-xs ${s.done ? 'text-gray-700' : 'text-gray-400'}`}>{s.label}</span>
          {s.date && <span className="text-[11px] text-gray-400 ml-auto">{formatDate(s.date)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function ArWorkspaceInvoicesPage() {
  const [orgs, setOrgs] = useState<OrgArSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orgFilter, setOrgFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('issued'); // Default to owed
  const [daysFilter, setDaysFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const [paidThisMonth, setPaidThisMonth] = useState<{ count: number; amount: number }>({ count: 0, amount: 0 });

  const [showGenerate, setShowGenerate] = useState(false);
  const [genTenantId, setGenTenantId] = useState('');
  // Default the billing period to the current month — the common "bill this
  // month" case is then one click. Claims are matched by service date.
  const [genFrom, setGenFrom] = useState<string>(() => startOfCurrentMonth());
  const [genTo, setGenTo] = useState<string>(() => todayDate());
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Approved claims on file for the selected org (guidance, not a hard preview —
  // invoicing also excludes claims already on an existing invoice).
  const [genApproved, setGenApproved] = useState<number | null>(null);
  const [genApprovedLoading, setGenApprovedLoading] = useState(false);
  // When set, the org drill-down is auto-opened once the ledger refreshes with
  // the newly generated draft invoice (drives the "View Draft" link too).
  const [pendingOpenOrg, setPendingOpenOrg] = useState<string | null>(null);

  const [selectedOrg, setSelectedOrg] = useState<OrgArSummary | null>(null);
  const [orgInvoices, setOrgInvoices] = useState<ArInvoice[]>([]);
  const [orgInvoicesLoading, setOrgInvoicesLoading] = useState(false);
  const [orgInvoicesError, setOrgInvoicesError] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<{ href: string; label: string } | null>(null);

  // Approved claims awaiting billing (finance queue) — guidance in the header.
  const [readyForBilling, setReadyForBilling] = useState<number>(0);

  const fetchReadyForBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/reimbursements?status=approved&limit=1');
      if (!res.ok) return;
      const data: { total?: number } = await res.json();
      setReadyForBilling(data.total ?? 0);
    } catch {
      // Best-effort guidance.
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/tenants');
      if (!res.ok) return;
      const data: TenantOption[] = await res.json();
      setTenants(Array.isArray(data) ? data : []);
    } catch {
      // Convenience picker — fail quietly.
    }
  }, []);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgFilter) params.set('tenantId', orgFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (daysFilter) params.set('daysOutstanding', daysFilter);
      if (searchFilter.trim()) params.set('search', searchFilter.trim());
      params.set('skip', String(skip));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/super-admin/invoices/ledger?${params.toString()}`);
      if (!res.ok) {
        setError(await readError(res));
        setOrgs([]);
        setTotal(0);
        return;
      }
      const data: ArLedgerResponse = await res.json();
      setOrgs(data.organizations ?? []);
      setTotal(data.total ?? 0);
      setPaidThisMonth(data.paidThisMonth ?? { count: 0, amount: 0 });
    } catch (err) {
      setError(getErrorMessage(err));
      setOrgs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [orgFilter, statusFilter, daysFilter, searchFilter, skip]);

  const fetchOrgInvoices = useCallback(async (orgId: string) => {
    setOrgInvoicesLoading(true);
    setOrgInvoicesError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('tenantId', orgId);
      params.set('limit', String(100));

      const res = await fetch(`/api/super-admin/invoices?${params.toString()}`);
      if (!res.ok) {
        setOrgInvoicesError(await readError(res));
        setOrgInvoices([]);
        return;
      }
      const data: { invoices: ArInvoice[] } = await res.json();
      setOrgInvoices(data.invoices ?? []);
    } catch (err) {
      setOrgInvoicesError(getErrorMessage(err));
      setOrgInvoices([]);
    } finally {
      setOrgInvoicesLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchTenants(); }, [fetchTenants]);
  useEffect(() => { void fetchLedger(); }, [fetchLedger]);
  useEffect(() => { void fetchReadyForBilling(); }, [fetchReadyForBilling]);

  // The "View Draft" success link carries `?openOrg=<tenantId>`; on load, open
  // that org's invoice drill-down so the new draft is in front of the admin.
  // The status filter is cleared so the fresh `draft` is visible.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openOrg = params.get('openOrg');
    if (openOrg) {
      setPendingOpenOrg(openOrg);
      setStatusFilter('');
      const url = new URL(window.location.href);
      url.searchParams.delete('openOrg');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  // Once the ledger contains the target org, open its invoices. Auto-opens right
  // after Generate (the refreshed ledger includes the new draft) and after
  // landing on a `?openOrg=` link.
  useEffect(() => {
    if (!pendingOpenOrg) return;
    const org = orgs.find((o) => o.orgId === pendingOpenOrg);
    if (!org) return;
    setSelectedOrg(org);
    void fetchOrgInvoices(org.orgId);
    setPendingOpenOrg(null);
  }, [orgs, pendingOpenOrg, fetchOrgInvoices]);

  // Approved-claims count for the selected org — tells the admin whether billing
  // is even possible before they pick a period and hit Generate.
  useEffect(() => {
    if (!genTenantId) {
      setGenApproved(null);
      return;
    }
    let cancelled = false;
    setGenApprovedLoading(true);
    fetch(`/api/super-admin/reimbursements?status=approved&tenantId=${encodeURIComponent(genTenantId)}&limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setGenApproved((data?.total as number | undefined) ?? 0); })
      .catch(() => { if (!cancelled) setGenApproved(0); })
      .finally(() => { if (!cancelled) setGenApprovedLoading(false); });
    return () => { cancelled = true; };
  }, [genTenantId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  const kpiTotalOutstanding = useMemo(() => orgs.reduce((sum, o) => sum + o.totalOutstanding, 0), [orgs]);
  const kpiOverdue = useMemo(() => orgs.reduce((sum, o) => sum + o.overdueAmount, 0), [orgs]);
  const kpiInvoiceCount = useMemo(() => orgs.reduce((sum, o) => sum + o.invoiceCount, 0), [orgs]);
  const kpiOverdueCount = useMemo(() => orgs.filter((o) => o.arStatus === '31-60' || o.arStatus === '61-90' || o.arStatus === '90+').length, [orgs]);

  async function handleGenerate() {
    if (!genTenantId || !genFrom || !genTo) {
      setGenError('Organization, from, and to are required.');
      return;
    }
    setGenLoading(true);
    setGenError(null);
    try {
      const res = await fetch('/api/super-admin/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: genTenantId, from: genFrom, to: genTo }),
      });
      if (!res.ok) {
        const raw = await readError(res);
        if (raw.includes('No approved claims')) {
          setGenError(
            `No approved claims to invoice for this period. Claims are matched by service date between ${genFrom} and ${genTo}, and claims already on an existing invoice are excluded.`,
          );
        } else {
          setGenError(raw);
        }
        return;
      }
      const created = await res.json();
      const orgName = tenants.find((t) => t.id === genTenantId)?.name ?? 'the organization';
      setShowGenerate(false);
      setGenTenantId('');
      setGenFrom(startOfCurrentMonth());
      setGenTo(todayDate());
      setSkip(0);
      setSuccess(`Invoice ${created?.invoiceNumber ?? ''} created for ${orgName}. Review the draft, then issue it to send.`);
      // Real navigation: the page reads `?openOrg=` and opens that org's invoices
      // so the new draft is immediately visible (status filter cleared to show it).
      setSuccessLink({ href: `/invoices?openOrg=${encodeURIComponent(genTenantId)}`, label: 'View Draft' });
      setStatusFilter('');
      setPendingOpenOrg(genTenantId);
      void fetchReadyForBilling();
    } catch (err) {
      setGenError(getErrorMessage(err));
    } finally {
      setGenLoading(false);
    }
  }

  async function runAction(invoiceId: string, action: 'issue' | 'pay' | 'archive') {
    setActionId(invoiceId);
    setActionError(null);
    setSuccess(null);
    setSuccessLink(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      if (action === 'issue') {
        setSuccess('Invoice issued. Awaiting company payment.');
      } else if (action === 'pay') {
        setSuccess('Payment received. Linked claims moved to Payments.');
        setSuccessLink({ href: '/payments', label: 'Go To Payments' });
      } else {
        setSuccess('Invoice archived.');
      }
      if (selectedOrg) await fetchOrgInvoices(selectedOrg.orgId);
      void fetchLedger();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  function exportCsv(invoiceId: string) {
    window.open(`/api/super-admin/invoices/${invoiceId}/export`, '_blank');
  }

  function exportOrgCsv(orgId: string) {
    window.open(`/api/super-admin/invoices/export/${orgId}`, '_blank');
  }

  function exportAgingReport() {
    window.open('/api/super-admin/invoices/report/aging', '_blank');
  }

  function viewOrg(org: OrgArSummary) {
    setSelectedOrg(org);
    void fetchOrgInvoices(org.orgId);
  }

  function backToOverview() {
    setSelectedOrg(null);
    setOrgInvoices([]);
    setOrgInvoicesError(null);
  }

  const getAgingColor = (arStatus: string) => {
    switch (arStatus) {
      case 'current': return 'bg-green-100 text-green-800';
      case '1-30': return 'bg-green-100 text-green-700';
      case '31-60': return 'bg-yellow-100 text-yellow-800';
      case '61-90': return 'bg-orange-100 text-orange-800';
      case '90+': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedOrg && (
                <button onClick={backToOverview} className="text-gray-500 hover:text-gray-700">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedOrg ? `${selectedOrg.orgName}` : 'Invoices'}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedOrg
                    ? `Accounts Receivable for ${selectedOrg.orgName}`
                    : 'Accounts Receivable Workspace — who owes Remedy money.'}
                </p>
              </div>
            </div>
            {!selectedOrg && (
              <button
                onClick={() => { setShowGenerate(true); setGenError(null); }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" /> Generate Invoice
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedOrg && (
        <>
          {/* Success / next-step feedback */}
          {success && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <SuccessBanner message={success} action={successLink} />
            </div>
          )}

          {/* Ready for billing — approved claims awaiting invoicing */}
          {readyForBilling > 0 && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Ready for billing.</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {readyForBilling} approved claim{readyForBilling === 1 ? '' : 's'} {readyForBilling === 1 ? 'is' : 'are'} waiting to be invoiced. Select an organization and period, then generate.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowGenerate(true); setGenError(null); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition"
                  >
                    <Plus className="h-4 w-4" /> Generate Invoice
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-500">Total Outstanding</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpiTotalOutstanding)}</p>
                <p className="text-xs text-gray-500 mt-1">Issued, not yet paid</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs font-medium text-gray-500">Overdue (&gt;30 days)</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpiOverdue)}</p>
                <p className="text-xs text-gray-500 mt-1">Needs collection action</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-gray-500">Awaiting Payment</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpiInvoiceCount}</p>
                <p className="text-xs text-gray-500 mt-1">Open invoices</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-xs font-medium text-gray-500">Overdue Orgs</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpiOverdueCount}</p>
                <p className="text-xs text-gray-500 mt-1">Escalation required</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-gray-500">Paid This Month</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(paidThisMonth.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">{paidThisMonth.count} invoice{paidThisMonth.count === 1 ? '' : 's'} settled</p>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <WorkflowStepper current="invoices" />

            <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
                <select value={orgFilter} onChange={(e) => { setOrgFilter(e.target.value); setSkip(0); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">All Organizations</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  {Object.entries(PAYMENT_STATUS_CONFIG).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">Days Outstanding</label>
                <select value={daysFilter} onChange={(e) => { setDaysFilter(e.target.value); setSkip(0); }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                  <option value="">All</option>
                  <option value="current">Current (0-30)</option>
                  <option value="1-30">1-30 days</option>
                  <option value="31-60">31-60 days</option>
                  <option value="61-90">61-90 days</option>
                  <option value="90+">90+ days</option>
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -mt-2 h-4 w-4 text-gray-400" />
                  <input type="text" placeholder="Org name, invoice #" value={searchFilter}
                    onChange={(e) => { setSearchFilter(e.target.value); setSkip(0); }}
                    className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            {actionError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{actionError}</p>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {!loading && error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!loading && !error && orgs.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">
                  {readyForBilling > 0 ? 'No invoices yet — approved claims are waiting to be billed.' : 'No invoices yet'}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {readyForBilling > 0
                    ? `${readyForBilling} approved claim${readyForBilling === 1 ? '' : 's'} ${readyForBilling === 1 ? 'is' : 'are'} waiting to be invoiced. Click "Generate Invoice" to bill an organization.`
                    : 'Invoices are created here from approved claims. Once approved claims exist, generate an invoice to bill an organization.'}
                </p>
                {readyForBilling > 0 && (
                  <button
                    onClick={() => { setShowGenerate(true); setGenError(null); }}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" /> Generate Invoice
                  </button>
                )}
              </div>
            )}

            {!loading && !error && orgs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Total Outstanding</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Overdue (&gt;30 days)</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Open Invoices</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Last Invoice</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Last Payment</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org) => (
                      <tr key={org.orgId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{org.orgName}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(org.totalOutstanding)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(org.overdueAmount)}</td>
                        <td className="px-4 py-3 text-gray-700">{org.invoiceCount}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{org.lastInvoiceNumber ?? '—'}<br />{formatDate(org.lastInvoiceDate)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatCurrency(org.lastPaymentAmount ?? 0)}<br />{formatDate(org.lastPaymentDate)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getAgingColor(org.arStatus)}`}>
                            {org.arStatus === 'current' || org.arStatus === '1-30' ? 'Current' : org.arStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => viewOrg(org)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                              <Eye className="h-3 w-3" /> View Invoices
                            </button>
                            <button onClick={() => exportOrgCsv(org.orgId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
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

            {!loading && !error && orgs.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} organizations
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))} disabled={skip <= 0}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    Previous
                  </button>
                  <span className="px-2 text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setSkip(Math.min((totalPages - 1) * PAGE_SIZE, skip + PAGE_SIZE))} disabled={skip + PAGE_SIZE >= total}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {selectedOrg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{selectedOrg.orgName} — Invoices</h2>
              <p className="text-sm text-gray-500">
                Total Outstanding: {formatCurrency(selectedOrg.totalOutstanding)} · {selectedOrg.invoiceCount} open invoices
              </p>
            </div>
            <button onClick={() => exportOrgCsv(selectedOrg.orgId)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Download className="h-3 w-3" /> Export Org Data
            </button>
          </div>

          {orgInvoicesError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{orgInvoicesError}</p>
            </div>
          )}

          {orgInvoicesLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {!orgInvoicesLoading && !orgInvoicesError && orgInvoices.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No invoices match your filters</p>
            </div>
          )}

          {!orgInvoicesLoading && !orgInvoicesError && orgInvoices.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Outstanding</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Issue Date</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Timeline</th>
                    <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgInvoices.map((invoice) => {
                    const sc = AR_STATUS_CONFIG[invoice.status] ?? AR_STATUS_CONFIG.draft;
                    const isIssued = invoice.status === 'issued';
                    const canArchive = invoice.status === 'paid' || invoice.status === 'draft' || invoice.status === 'generated';
                    return (
                      <tr key={invoice.invoiceId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <a href={`/invoices/${invoice.invoiceId}`}
                            className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800">
                            {invoice.invoiceNumber}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatCurrency(invoice.totalAmount)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {isIssued ? formatCurrency(invoice.totalAmount) : '0.000'}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(invoice.issuedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <InvoiceTimeline invoice={invoice} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {(invoice.status === 'draft' || invoice.status === 'generated') && (
                              <button onClick={() => runAction(invoice.invoiceId, 'issue')}
                                disabled={actionId === invoice.invoiceId}
                                className="inline-flex items-center rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                                <Send className="h-3 w-3" /> Issue
                              </button>
                            )}
                            {isIssued && (
                              <button onClick={() => runAction(invoice.invoiceId, 'pay')}
                                disabled={actionId === invoice.invoiceId}
                                className="inline-flex items-center rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                                <CheckCircle2 className="h-3 w-3" /> Mark Paid
                              </button>
                            )}
                            {canArchive && (
                              <button onClick={() => runAction(invoice.invoiceId, 'archive')}
                                disabled={actionId === invoice.invoiceId}
                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                                <Archive className="h-3 w-3" /> Archive
                              </button>
                            )}
                            <button onClick={() => exportCsv(invoice.invoiceId)}
                              className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                              <Download className="h-3 w-3" /> Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Generate Invoice</h3>
            <p className="text-sm text-gray-500 mb-5">
              Creates a draft invoice from approved claims for the selected organization. Claims are
              matched by <span className="font-medium text-gray-700">service date</span> within the period;
              claims already on an existing invoice are excluded.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
                <select value={genTenantId} onChange={(e) => setGenTenantId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200">
                  <option value="">Select organization...</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {genTenantId && genApprovedLoading && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking approved claims…
                  </p>
                )}
                {genTenantId && !genApprovedLoading && genApproved !== null && (
                  genApproved === 0 ? (
                    <p className="mt-1 text-xs text-amber-600">
                      No approved claims on file for this organization — nothing to bill yet.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      {genApproved} approved claim{genApproved === 1 ? '' : 's'} on file. Invoicing picks
                      those with a service date inside the period.
                    </p>
                  )
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
                  <input type="date" value={genFrom} onChange={(e) => setGenFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                  <input type="date" value={genTo} onChange={(e) => setGenTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Defaults to the current month — adjust to bill a different service-date range.
              </p>

              {genError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{genError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowGenerate(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={handleGenerate} disabled={genLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {genLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {genLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedOrg && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-gray-200">
          <div className="flex gap-3">
            <button onClick={exportAgingReport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <BarChart3 className="h-4 w-4" /> Aging Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
