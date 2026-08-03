'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Search, ChevronLeft, ChevronRight, AlertCircle, AlertTriangle, Banknote, X,
} from 'lucide-react';

interface Claim {
  reimbursementId: string;
  claimNumber?: string;
  tenantId: string;
  tenantName: string;
  employeeName: string;
  clinicName?: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  status: 'pending' | 'in_progress' | 'approved' | 'to_be_paid' | 'rejected' | 'frozen' | 'paid';
  createdAt: string;
  updatedAt: string;
}

interface ClaimsResponse {
  claims: Claim[];
  total: number;
}

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  to_be_paid: { label: 'To Be Paid', color: 'bg-orange-100 text-orange-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  frozen: { label: 'Frozen', color: 'bg-sky-100 text-sky-700' },
  paid: { label: 'Paid', color: 'bg-purple-100 text-purple-700' },
};

const UPDATE_TEMPLATES = ['Currently with finance', 'Reached Remedy', 'Almost done'];

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function SuperAdminClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [skip, setSkip] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter, tenantFilter, searchFilter, skip]);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (tenantFilter) params.set('tenantId', tenantFilter);
      if (searchFilter) params.set('search', searchFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('skip', String(skip));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/super-admin/reimbursements?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load claims.');
      const data: ClaimsResponse = await res.json();
      setClaims(data.claims ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tenantFilter, searchFilter, dateFrom, dateTo, sortBy, sortOrder, skip]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  // ── Stats with amounts ─────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const s = { total, totalAmount: 0, pending: 0, pendingAmount: 0, in_progress: 0, inProgressAmount: 0, approved: 0, approvedAmount: 0, to_be_paid: 0, toBePaidAmount: 0, rejected: 0, rejectedAmount: 0, frozen: 0, frozenAmount: 0, paid: 0, paidAmount: 0 };
    for (const c of claims) {
      s.totalAmount += c.amount;
      if (c.status === 'pending') { s.pending++; s.pendingAmount += c.amount; }
      if (c.status === 'in_progress') { s.in_progress++; s.inProgressAmount += c.amount; }
      if (c.status === 'approved') { s.approved++; s.approvedAmount += c.amount; }
      if (c.status === 'to_be_paid') { s.to_be_paid++; s.toBePaidAmount += c.amount; }
      if (c.status === 'rejected') { s.rejected++; s.rejectedAmount += c.amount; }
      if (c.status === 'frozen') { s.frozen++; s.frozenAmount += c.amount; }
      if (c.status === 'paid') { s.paid++; s.paidAmount += c.amount; }
    }
    return s;
  }, [claims, total]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  const allSelected = claims.length > 0 && claims.every((c) => selectedIds.has(c.reimbursementId));

  /**
   * Phase 5 payout flow: approved claims are first queued for payment
   * (`approved → to_be_paid`) and then paid (`to_be_paid → paid`). Claims that
   * are already `to_be_paid` are paid directly.
   */
  async function paySelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setActionLoading(true);
    for (const id of ids) {
      try {
        const claim = claims.find((c) => c.reimbursementId === id);
        if (claim?.status === 'approved') {
          await fetch(`/api/super-admin/reimbursements/${id}/queue-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        }
        await fetch(`/api/super-admin/reimbursements/${id}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch { /* continue */ }
    }
    setSelectedIds(new Set());
    setActionLoading(false);
    fetchClaims();
  }

  /**
   * Bulk progress update (FR-046): send one update message to the selected
   * claims. The Tenant App bulk-update endpoint is tenant-scoped, so the
   * selection is grouped by tenantId and one request is sent per tenant.
   */
  async function sendUpdate() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const message = updateMessage.trim();
    if (!message) {
      setUpdateError('Message is required.');
      return;
    }

    const byTenant = new Map<string, string[]>();
    for (const id of ids) {
      const claim = claims.find((c) => c.reimbursementId === id);
      if (claim) {
        const list = byTenant.get(claim.tenantId) ?? [];
        list.push(claim.reimbursementId);
        byTenant.set(claim.tenantId, list);
      }
    }

    setActionLoading(true);
    let updated = 0;
    let skipped = 0;
    for (const [tenantId, claimIds] of byTenant) {
      try {
        const res = await fetch('/api/super-admin/reimbursements/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, claimIds, message }),
        });
        if (res.ok) {
          const data = await res.json();
          updated += data.updated ?? 0;
          skipped += data.skipped ?? 0;
        } else {
          skipped += claimIds.length;
        }
      } catch {
        skipped += claimIds.length;
      }
    }

    setUpdateModal(false);
    setUpdateMessage('');
    setUpdateError('');
    setSelectedIds(new Set());
    setActionLoading(false);
    fetchClaims();
  }

  function openUpdateModal() {
    setUpdateMessage('');
    setUpdateError('');
    setUpdateModal(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claims Oversight</h1>
              <p className="mt-1 text-sm text-gray-500">Cross-tenant claims management and payout hub.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards with Amounts */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-8">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{stats.pending}</p>
              <p className="text-xs text-amber-600 mt-0.5">{formatCurrency(stats.pendingAmount)}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">In Progress</p>
              <p className="mt-1 text-2xl font-bold text-blue-800">{stats.in_progress}</p>
              <p className="text-xs text-blue-600 mt-0.5">{formatCurrency(stats.inProgressAmount)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Approved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.approved}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{formatCurrency(stats.approvedAmount)}</p>
            </div>
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">To Be Paid</p>
              <p className="mt-1 text-2xl font-bold text-orange-800">{stats.to_be_paid}</p>
              <p className="text-xs text-orange-600 mt-0.5">{formatCurrency(stats.toBePaidAmount)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-red-800">{stats.rejected}</p>
              <p className="text-xs text-red-600 mt-0.5">{formatCurrency(stats.rejectedAmount)}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Frozen</p>
              <p className="mt-1 text-2xl font-bold text-sky-800">{stats.frozen}</p>
              <p className="text-xs text-sky-600 mt-0.5">{formatCurrency(stats.frozenAmount)}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Paid</p>
              <p className="mt-1 text-2xl font-bold text-purple-800">{stats.paid}</p>
              <p className="text-xs text-purple-600 mt-0.5">{formatCurrency(stats.paidAmount)}</p>
            </div>
          </div>
        )}

        {/* Payout Hub — Quick action for approved / to_be_paid claims */}
        {(stats.approved > 0 || stats.to_be_paid > 0) && !loading && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Banknote className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    {stats.approved} approved claims ready to queue for payout
                  </p>
                  <p className="text-xs text-emerald-600">
                    {stats.to_be_paid > 0
                      ? `${stats.to_be_paid} queued claims (${formatCurrency(stats.toBePaidAmount)}) awaiting payout. `
                      : ''}
                    Select claims below and queue approved ones for payment, then mark queued claims as paid.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
            <input type="text" placeholder="Claim #, employee, tenant..." value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="to_be_paid">To Be Paid</option>
              <option value="rejected">Rejected</option>
              <option value="frozen">Frozen</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as 'createdAt' | 'updatedAt' | 'status'); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Order</label>
            <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value as 'asc' | 'desc'); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 rounded-xl bg-gray-900 px-5 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{selectedIds.size} selected</p>
              <div className="flex gap-2">
                <button onClick={paySelected} disabled={actionLoading}
                  className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-600 disabled:opacity-50">
                  {actionLoading ? 'Processing...' : 'Queue & Mark Paid'}
                </button>
                <button onClick={openUpdateModal} disabled={actionLoading}
                  className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50">
                  Send Update
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && claims.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No claims found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filter criteria.</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && claims.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected}
                      onChange={() => setSelectedIds(allSelected ? new Set() : new Set(claims.map((c) => c.reimbursementId)))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Claim #</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Employee</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Amount</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Age</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => {
                  const sc = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={claim.reimbursementId}
                      onClick={() => router.push(`/reimbursements/${claim.reimbursementId}`)}
                      className="cursor-pointer border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(claim.reimbursementId)}
                          onChange={() => { const n = new Set(selectedIds); n.has(claim.reimbursementId) ? n.delete(claim.reimbursementId) : n.add(claim.reimbursementId); setSelectedIds(n); }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">{claim.claimNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-900">{claim.tenantName}</td>
                      <td className="px-4 py-3 text-gray-700">{claim.employeeName}</td>
                      <td className="hidden px-4 py-3 font-medium text-gray-900 md:table-cell">{formatCurrency(claim.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {(() => {
                          const days = Math.floor((Date.now() - new Date(claim.updatedAt || claim.createdAt).getTime()) / 86400000);
                          return <span className={`inline-flex items-center gap-1 text-xs font-medium ${days >= 7 ? 'text-red-500' : 'text-gray-400'}`}>
                            {days >= 7 && <AlertTriangle className="h-3 w-3" />}{days}d
                          </span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} claims</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))} disabled={skip <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="px-2 text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setSkip(Math.min((totalPages - 1) * PAGE_SIZE, skip + PAGE_SIZE))} disabled={skip + PAGE_SIZE >= total}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Send Update Modal */}
      {updateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setUpdateModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Send Update</h3>
              <button type="button" onClick={() => setUpdateModal(false)}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-1 text-sm text-gray-500">
              Send a progress update to the selected claims. The employee will be notified.
            </p>

            <p className="mb-4 text-xs font-medium text-gray-400">
              {selectedIds.size} claim{selectedIds.size !== 1 ? 's' : ''} selected
            </p>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {UPDATE_TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => { setUpdateMessage(template); setUpdateError(''); }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      updateMessage === template
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {template}
                  </button>
                ))}
              </div>

              <textarea
                value={updateMessage}
                onChange={(e) => { setUpdateMessage(e.target.value); if (e.target.value.trim()) setUpdateError(''); }}
                placeholder="Enter the update message... e.g. Currently with finance"
                rows={4}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ${
                  updateError ? 'border-red-300' : 'border-gray-200 focus:border-blue-300'
                }`}
                autoFocus
              />
              {updateError && (
                <p className="text-xs text-red-600">{updateError}</p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setUpdateModal(false)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendUpdate}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
