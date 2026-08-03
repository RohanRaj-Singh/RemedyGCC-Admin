'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Search, AlertCircle, Plus, FileSpreadsheet, Download, Send, CheckCircle2,
} from 'lucide-react';

interface InvoiceLineItem {
  claimId: string;
  claimNumber?: string;
  clinicName?: string;
  amount: number;
  sessionCount?: number;
  serviceDate?: string;
}

interface Invoice {
  invoiceId: string;
  tenantId: string;
  invoiceNumber: string;
  period: { from: string; to: string };
  status: 'draft' | 'generated' | 'issued' | 'paid';
  generatedBy: string;
  generatedAt: string;
  issuedAt?: string;
  paidAt?: string;
  totalAmount: number;
  lineItems: InvoiceLineItem[];
  createdAt: string;
  updatedAt: string;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
}

interface TenantOption {
  tenantId: string;
  name: string;
  slug: string;
}

const PAGE_SIZE = 20;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  generated: { label: 'Generated', color: 'bg-blue-100 text-blue-700' },
  issued: { label: 'Issued', color: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
};

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatPeriodDate(dateStr: string) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
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

export default function SuperAdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tenantFilter, setTenantFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [skip, setSkip] = useState(0);

  // Generate modal state.
  const [showGenerate, setShowGenerate] = useState(false);
  const [genTenantId, setGenTenantId] = useState('');
  const [genFrom, setGenFrom] = useState('');
  const [genTo, setGenTo] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Per-row action state.
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tenantNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tenants) map.set(t.tenantId, t.name);
    return map;
  }, [tenants]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/tenants');
      if (!res.ok) return;
      const data: TenantOption[] = await res.json();
      setTenants(Array.isArray(data) ? data : []);
    } catch {
      // Tenant picker is a convenience — fail quietly.
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (statusFilter) params.set('status', statusFilter);
      params.set('skip', String(skip));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/super-admin/invoices?${params.toString()}`);
      if (!res.ok) {
        setError(await readError(res));
        setInvoices([]);
        setTotal(0);
        return;
      }
      const data: InvoiceListResponse = await res.json();
      setInvoices(data.invoices ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(getErrorMessage(err));
      setInvoices([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenantFilter, statusFilter, skip]);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  async function handleGenerate() {
    if (!genTenantId || !genFrom || !genTo) {
      setGenError('Tenant, from, and to are required.');
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
        setGenError(await readError(res));
        return;
      }
      setShowGenerate(false);
      setGenTenantId('');
      setGenFrom('');
      setGenTo('');
      setSkip(0);
      void fetchInvoices();
    } catch (err) {
      setGenError(getErrorMessage(err));
    } finally {
      setGenLoading(false);
    }
  }

  async function runAction(invoiceId: string, action: 'issue' | 'pay') {
    setActionId(invoiceId);
    setActionError(null);
    try {
      const res = await fetch(`/api/super-admin/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      void fetchInvoices();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setActionId(null);
    }
  }

  function exportCsv(invoiceId: string) {
    window.open(`/api/super-admin/invoices/${invoiceId}/export`, '_blank');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
              <p className="mt-1 text-sm text-gray-500">
                Generate consolidated Remedy invoices per organization from approved claims.
              </p>
            </div>
            <button
              onClick={() => { setShowGenerate(true); setGenError(null); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" /> Generate Invoice
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Tenant</label>
            <select
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Tenants</option>
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="generated">Generated</option>
              <option value="issued">Issued</option>
              <option value="paid">Paid</option>
            </select>
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

        {!loading && !error && invoices.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No invoices found</p>
            <p className="text-sm text-gray-400 mt-1">
              Use “Generate Invoice” to create one from approved claims for an organization.
            </p>
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 font-semibold text-gray-600">Invoice #</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Period</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Total</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const sc = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
                  const canIssue = invoice.status === 'draft' || invoice.status === 'generated';
                  const canPay = invoice.status === 'issued';
                  return (
                    <tr key={invoice.invoiceId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {tenantNameById.get(invoice.tenantId) ?? invoice.tenantId}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatPeriodDate(invoice.period.from)} – {formatPeriodDate(invoice.period.to)}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canIssue && (
                            <button
                              onClick={() => runAction(invoice.invoiceId, 'issue')}
                              disabled={actionId === invoice.invoiceId}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Send className="h-3 w-3" />
                              {actionId === invoice.invoiceId ? 'Issuing...' : 'Issue'}
                            </button>
                          )}
                          {canPay && (
                            <button
                              onClick={() => runAction(invoice.invoiceId, 'pay')}
                              disabled={actionId === invoice.invoiceId}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {actionId === invoice.invoiceId ? 'Paying...' : 'Mark Paid'}
                            </button>
                          )}
                          {invoice.lineItems.length > 0 && (
                            <button
                              onClick={() => exportCsv(invoice.invoiceId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                              <Download className="h-3 w-3" /> Export CSV
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} invoices
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                disabled={skip <= 0}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setSkip(Math.min((totalPages - 1) * PAGE_SIZE, skip + PAGE_SIZE))}
                disabled={skip + PAGE_SIZE >= total}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Invoice Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Generate Invoice</h3>
            <p className="text-sm text-gray-500 mb-5">
              Creates one consolidated invoice from approved claims in the selected period.
              Claims already on an existing invoice are excluded.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
                <select
                  value={genTenantId}
                  onChange={(e) => setGenTenantId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select tenant...</option>
                  {tenants.map((t) => (
                    <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
                  <input
                    type="date"
                    value={genFrom}
                    onChange={(e) => setGenFrom(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                  <input
                    type="date"
                    value={genTo}
                    onChange={(e) => setGenTo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              {genError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{genError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGenerate(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={genLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {genLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {genLoading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
