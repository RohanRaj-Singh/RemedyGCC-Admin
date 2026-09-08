'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare, RefreshCw, Search, Filter, Clock, CheckCircle2, XCircle,
  HelpCircle, MessagesSquare, ChevronRight,
} from 'lucide-react';
import FinancialEmptyState from '@/components/financial/FinancialEmptyState';
import { FinancialTableSkeleton, FinancialSummarySkeleton } from '@/components/financial/FinancialSkeleton';
import { formatDate } from '@/lib/financial/format';

// ── Types (mirror of `GET /api/super-admin/requests`) ───────────────────────

type RequestStatus = 'pending' | 'approved' | 'rejected' | 'more_info' | 'converted_to_chat';
type RequesterRole = 'employee' | 'clinic' | 'tenantAdmin';

interface RequestRow {
  requestId: string;
  subject: string;
  body: string;
  status: RequestStatus;
  requester?: { role?: RequesterRole; name?: string };
  tenantId?: string;
  claimId?: string;
  claimNumber?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface ListResponse {
  requests: RequestRow[];
  total: number;
  limit: number;
  skip: number;
}

type StatusFilter = 'all' | RequestStatus;

// ── Display helpers ─────────────────────────────────────────────────────────

const STATUS_META: Record<RequestStatus, { label: string; tone: string; icon: typeof Clock }> = {
  pending:          { label: 'Pending',          tone: 'bg-amber-100 text-amber-800',         icon: Clock },
  approved:         { label: 'Approved',         tone: 'bg-emerald-100 text-emerald-800',     icon: CheckCircle2 },
  rejected:         { label: 'Rejected',         tone: 'bg-rose-100 text-rose-800',           icon: XCircle },
  more_info:        { label: 'Needs more info',  tone: 'bg-sky-100 text-sky-800',             icon: HelpCircle },
  converted_to_chat:{ label: 'Moved to chat',    tone: 'bg-indigo-100 text-indigo-800',       icon: MessagesSquare },
};

const ROLE_LABEL: Record<RequesterRole, string> = {
  employee: 'Employee',
  clinic: 'Clinic',
  tenantAdmin: 'Tenant admin',
};

function StatusPill({ status }: { status: RequestStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RequestsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | RequesterRole>('all');
  const [query, setQuery] = useState('');

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (roleFilter !== 'all') params.set('requesterRole', roleFilter);
    if (query.trim()) params.set('search', query.trim());
    params.set('limit', '100');
    return params.toString();
  }, [statusFilter, roleFilter, query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/super-admin/requests?${qs}`);
      if (!res.ok) throw new Error('Failed to load requests.');
      const payload: ListResponse = await res.json();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => { void load(); }, [load]);

  // Summary counts (derived from currently-loaded page; informational only).
  const counts = useMemo(() => {
    const out: Record<RequestStatus | 'total', number> = {
      total: 0, pending: 0, approved: 0, rejected: 0, more_info: 0, converted_to_chat: 0,
    };
    (data?.requests ?? []).forEach((r) => {
      out.total++;
      out[r.status] = (out[r.status] ?? 0) + 1;
    });
    return out;
  }, [data]);

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Requests</h1>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Cross-tenant oversight of organizational requests raised by employees or clinics.
          Decisions are routed through the authoritative service in Tenant App — this view does
          not modify the claim, invoice, or payment workflow.
        </p>
      </header>

      {/* Summary cards (informational) */}
      {loading && !data ? (
        <div className="mb-6">
          <FinancialSummarySkeleton cards={5} />
        </div>
      ) : data ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <SummaryCard label="Pending" value={counts.pending} tone="amber" />
          <SummaryCard label="Approved" value={counts.approved} tone="emerald" />
          <SummaryCard label="Rejected" value={counts.rejected} tone="rose" />
          <SummaryCard label="Needs more info" value={counts.more_info} tone="sky" />
          <SummaryCard label="Moved to chat" value={counts.converted_to_chat} tone="indigo" />
        </div>
      ) : null}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subject or body…"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter className="h-3.5 w-3.5" />
          Status
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="more_info">Needs more info</option>
          <option value="converted_to_chat">Moved to chat</option>
        </select>

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          Requester
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | RequesterRole)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All</option>
          <option value="employee">Employee</option>
          <option value="clinic">Clinic</option>
          <option value="tenantAdmin">Tenant admin</option>
        </select>

        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Body */}
      {loading && !data ? (
        <FinancialTableSkeleton rows={8} columns={5} />
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      ) : !data || data.requests.length === 0 ? (
        <FinancialEmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No requests match your filters"
          description={
            statusFilter === 'all' && roleFilter === 'all' && !query.trim()
              ? 'No requests have been raised yet across any tenant.'
              : 'Try clearing filters or broadening your search.'
          }
          action={
            statusFilter !== 'all' || roleFilter !== 'all' || query.trim()
              ? { label: 'Clear filters', onClick: () => {
                  setStatusFilter('all'); setRoleFilter('all'); setQuery('');
                }}
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="grid grid-cols-[2.5fr_1fr_1fr_1.2fr_24px] items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Subject</span>
            <span>Status</span>
            <span>Requester</span>
            <span>Updated</span>
            <span />
          </div>
          <div className="divide-y divide-gray-50">
            {data.requests.map((r) => (
              <Link
                key={r.requestId}
                href={`/requests/${encodeURIComponent(r.requestId)}`}
                className="grid grid-cols-[2.5fr_1fr_1fr_1.2fr_24px] items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{r.subject}</p>
                  {r.claimNumber && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      on {r.claimNumber}
                    </p>
                  )}
                </div>
                <div>
                  <StatusPill status={r.status} />
                </div>
                <div className="text-sm text-gray-700">
                  {r.requester?.role ? ROLE_LABEL[r.requester.role] : '—'}
                  {r.requester?.name && (
                    <span className="block text-xs text-gray-500 truncate">{r.requester.name}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(r.updatedAt ?? r.createdAt)}
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
            Showing {data.requests.length} of {data.total}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'rose' | 'sky' | 'indigo';
}) {
  const toneClass: Record<typeof tone, string> = {
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    sky: 'text-sky-700',
    indigo: 'text-indigo-700',
  } as const;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}