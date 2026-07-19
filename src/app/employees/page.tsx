'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Search, ChevronLeft, ChevronRight, AlertCircle, AlertTriangle,
  Lock, Users, UserPlus, XCircle, Clock, CheckCircle, Ban,
  KeyRound, ShieldX, ShieldCheck, Mail,
} from 'lucide-react';

interface Employee {
  employeeId: string;
  employeeCode: string;
  email: string;
  name: string;
  phoneNumber?: string | null;
  bankAccountNumber?: string | null;
  bankName?: string | null;
  status: 'not_registered' | 'active' | 'inactive' | 'suspended';
  tenantId: string;
  tenantName: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastAccessAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmployeesResponse {
  employees: Employee[];
  total: number;
}

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_registered: { label: 'Not Registered', color: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Inactive', color: 'bg-amber-100 text-amber-700' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700' },
};

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const n = new Date();
  const m = Math.floor((n.getTime() - d.getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [skip, setSkip] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter, searchFilter, tenantFilter, skip]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (searchFilter) p.set('search', searchFilter);
      if (statusFilter) p.set('status', statusFilter);
      if (tenantFilter) p.set('tenantId', tenantFilter);
      p.set('skip', String(skip)); p.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/super-admin/employees?${p.toString()}`);
      if (!res.ok) throw new Error('Failed to load employees.');
      const d: EmployeesResponse = await res.json();
      setEmployees(d.employees ?? []); setTotal(d.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
    } finally { setLoading(false); }
  }, [searchFilter, statusFilter, tenantFilter, skip]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const stats = {
    total,
    not_registered: employees.filter((e) => e.status === 'not_registered').length,
    active: employees.filter((e) => e.status === 'active').length,
    inactive: employees.filter((e) => e.status === 'inactive').length,
    suspended: employees.filter((e) => e.status === 'suspended').length,
    locked: employees.filter((e) => e.lockedUntil && new Date(e.lockedUntil) > new Date()).length,
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const allSelected = employees.length > 0 && employees.every((e) => selectedIds.has(e.employeeId));

  async function bulkAction(action: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setActionLoading(true);
    for (const id of ids) {
      try { await fetch(`/api/super-admin/employees/${id}/${action}`, { method: 'POST' }); }
      catch { /* continue */ }
    }
    setSelectedIds(new Set()); setActionLoading(false); fetchEmployees();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
              <p className="mt-1 text-sm text-gray-500">Cross-tenant employee management and account oversight.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-400 mt-0.5">All employees</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Active</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{stats.active}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Registered &amp; active</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Not Registered</p>
              <p className="mt-1 text-2xl font-bold text-gray-700">{stats.not_registered}</p>
              <p className="text-xs text-gray-400 mt-0.5">Awaiting registration</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Inactive</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{stats.inactive}</p>
              <p className="text-xs text-amber-600 mt-0.5">Deactivated</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Suspended</p>
              <p className="mt-1 text-2xl font-bold text-red-800">{stats.suspended}</p>
              <p className="text-xs text-red-600 mt-0.5">Admin suspended</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Locked</p>
              <p className="mt-1 text-2xl font-bold text-amber-800">{stats.locked}</p>
              <p className="text-xs text-amber-600 mt-0.5">Login locked</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
            <input type="text" placeholder="Name, email, or employee code..." value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Organization</label>
            <select value={tenantFilter} onChange={(e) => { setTenantFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">All Organizations</option>
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setSkip(0); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="not_registered">Not Registered</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 rounded-xl bg-gray-900 px-5 py-3 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{selectedIds.size} selected</p>
              <div className="flex gap-2">
                <button onClick={() => bulkAction('unsuspend')} disabled={actionLoading}
                  className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
                  <CheckCircle className="h-3 w-3 inline mr-1" />Unsuspend
                </button>
                <button onClick={() => bulkAction('suspend')} disabled={actionLoading}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50">
                  <Ban className="h-3 w-3 inline mr-1" />Suspend
                </button>
                <button onClick={() => bulkAction('unlock')} disabled={actionLoading}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50">
                  <Lock className="h-3 w-3 inline mr-1" />Unlock
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && employees.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No employees found</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && employees.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allSelected}
                      onChange={() => setSelectedIds(allSelected ? new Set() : new Set(employees.map((e) => e.employeeId)))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 sm:table-cell">Email</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Code</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Organization</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Last Access</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const sc = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.not_registered;
                  const isLocked = emp.lockedUntil && new Date(emp.lockedUntil) > new Date();
                  return (
                    <tr key={emp.employeeId}
                      onClick={() => router.push(`/employees/${emp.employeeId}`)}
                      className="cursor-pointer border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(emp.employeeId)}
                          onChange={() => { const n = new Set(selectedIds); n.has(emp.employeeId) ? n.delete(emp.employeeId) : n.add(emp.employeeId); setSelectedIds(n); }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name || '—'}</td>
                      <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">{emp.email}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-gray-600 md:table-cell">{emp.employeeCode}</td>
                      <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{emp.tenantName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.color}`}>
                          {sc.label}
                          {isLocked && <Lock className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{formatDate(emp.lastAccessAt)}</td>
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
            <p className="text-sm text-gray-500">Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} of {total} employees</p>
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
    </div>
  );
}
