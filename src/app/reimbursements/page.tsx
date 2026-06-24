'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Eye, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

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
  status: 'pending' | 'approved' | 'rejected' | 'frozen' | 'paid';
  createdAt: string;
  updatedAt: string;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

interface ClaimsResponse {
  claims: Claim[];
  total: number;
}

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  frozen: { label: 'Frozen', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', color: 'bg-purple-100 text-purple-700' },
};

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export default function ReimbursementsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [skip, setSkip] = useState(0);

  // Tenant options for dropdown
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  // Fetch tenant list on mount
  useEffect(() => {
    async function loadTenants() {
      setTenantsLoading(true);
      try {
        const res = await fetch('/api/super-admin/tenants');
        if (res.ok) {
          const data = await res.json();
          setTenantOptions(data.map((t: { tenantId?: string; id?: string; name: string; slug: string }) => ({
            id: t.tenantId ?? t.id,
            name: t.name,
            slug: t.slug,
          })));
        }
      } catch {
        // non-critical — dropdown will just be empty
      } finally {
        setTenantsLoading(false);
      }
    }
    loadTenants();
  }, []);

  // Fetch claims when filters change
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
  }, [statusFilter, tenantFilter, searchFilter, dateFrom, dateTo, skip]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // ── Computed stats (client-side, from loaded/visible claims) ───────────

  const stats = {
    visible: claims.length,
    total,
    pending: claims.filter((c) => c.status === 'pending').length,
    approved: claims.filter((c) => c.status === 'approved').length,
    rejected: claims.filter((c) => c.status === 'rejected').length,
    frozen: claims.filter((c) => c.status === 'frozen').length,
  };

  const summaryCards = [
    { label: 'Total', value: stats.total, color: 'bg-slate-100 text-slate-700' },
    { label: 'Pending', value: stats.pending, color: 'bg-amber-100 text-amber-700' },
    { label: 'Approved', value: stats.approved, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Rejected', value: stats.rejected, color: 'bg-red-100 text-red-700' },
    { label: 'Frozen', value: stats.frozen, color: 'bg-blue-100 text-blue-700' },
  ];

  // ── Pagination ─────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;

  const goToPage = (page: number) => {
    setSkip((page - 1) * PAGE_SIZE);
  };

  // ── Filter change handlers ─────────────────────────────────────────────

  const handleFilterChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    setter(e.target.value);
    setSkip(0);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSkip(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Claims Oversight</h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor reimbursement claims activity across all tenants.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {summaryCards.map((card) => (
              <div key={card.label} className={`rounded-xl border p-4 text-center ${card.color} border-transparent`}>
                <p className="text-3xl font-bold">{card.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide">{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by claim #, employee name..."
                value={searchFilter}
                onChange={handleFilterChange(setSearchFilter)}
                onKeyDown={handleSearchKeyDown}
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm placeholder-gray-400"
              />
            </div>
          </div>
          {/* Tenant */}
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Tenant</label>
            <select
              value={tenantFilter}
              onChange={handleFilterChange(setTenantFilter)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              disabled={tenantsLoading}
            >
              <option value="">All Tenants</option>
              {tenantOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {/* Status */}
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="frozen">Frozen</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          {/* Date From */}
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input type="date" value={dateFrom} onChange={handleFilterChange(setDateFrom)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
          {/* Date To */}
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input type="date" value={dateTo} onChange={handleFilterChange(setDateTo)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm" />
          </div>
        </div>

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
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 sm:table-cell">Claim #</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Tenant</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Employee</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Clinic</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Created</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => {
                  const sc = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.pending;
                  return (
                    <tr key={claim.reimbursementId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <p className="font-mono text-sm font-semibold text-gray-900">{claim.claimNumber ?? '—'}</p>
                        <p className="font-mono text-[10px] text-gray-400 mt-0.5">{claim.reimbursementId.slice(0, 12)}…</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{claim.tenantName}</td>
                      <td className="px-4 py-3 text-gray-700">{claim.employeeName}</td>
                      <td className="hidden px-4 py-3 text-gray-600 md:table-cell">{claim.clinicName || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(claim.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{formatDate(claim.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/reimbursements/${claim.reimbursementId}`)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4" /> View
                        </button>
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
            <p className="text-sm text-gray-500">
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} claims
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="px-2 text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
