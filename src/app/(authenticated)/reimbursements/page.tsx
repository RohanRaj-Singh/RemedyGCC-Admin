'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Landmark, RefreshCw, Search, Building2,
} from 'lucide-react';
import WorkflowStepper from '@/components/financial/WorkflowStepper';
import WorkspaceSegments from '@/components/financial/WorkspaceSegments';
import SuccessBanner from '@/components/financial/SuccessBanner';
import FinancialWorkflowHeader from '@/components/financial/FinancialWorkflowHeader';
import FinancialNextAction from '@/components/financial/FinancialNextAction';
import FinancialExceptionBanner from '@/components/financial/FinancialExceptionBanner';
import BillingEligibilityBadge from '@/components/financial/BillingEligibilityBadge';
import FinancialStatusBadge from '@/components/financial/FinancialStatusBadge';
import FinancialEmptyState from '@/components/financial/FinancialEmptyState';
import SelectionToolbar from '@/components/financial/SelectionToolbar';
import { FinancialTableSkeleton } from '@/components/financial/FinancialSkeleton';
import GenerateInvoiceDialog, {
  type ClaimOption,
} from '@/components/financial/GenerateInvoiceDialog';
import { formatCurrency } from '@/lib/financial/format';
import {
  CLAIM_STATUS_DISPLAY,
  CLAIM_STATUS_TONE,
  CLAIM_STATUSES,
  type ClaimStatus,
} from '@/lib/financial/status';
import { relativeAgeTone, relativeTimeShort } from '@/lib/financial/relativeTime';
import { isEligibleForInvoicing } from '@/lib/financial/eligibility';
import {
  clearSelection,
  selectionCount,
  selectionTotal,
  toggleSelection,
  type SelectionAmountMap,
} from '@/lib/financial/selection';
import { useTenants } from '@/context/TenantsProvider';

interface Claim {
  reimbursementId: string;
  claimNumber?: string;
  tenantId: string;
  tenantName: string;
  employeeName: string;
  clinicName?: string;
  amount: number;
  description: string;
  serviceDate?: string;
  sessionCount?: number;
  status: ClaimStatus;
  createdAt: string;
  updatedAt: string;
  /** Funding invoice linkage (read-time join — never a claim status). */
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
}

interface ClaimsResponse {
  claims: Claim[];
  total: number;
}

const PAGE_SIZE = 25;

/** Semantic text color for relative age on claim rows. Informational only. */
const AGE_TONE_CLASS = {
  neutral: 'text-gray-500',
  info: 'text-blue-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
} as const satisfies Record<import('@/lib/financial/relativeTime').RelativeAgeTone, string>;

export default function SuperAdminClaimsPage() {
  const router = useRouter();

  // PA2-A item 4: tenants list now comes from shared TenantsProvider so we
  // don't refetch /api/super-admin/tenants on every workspace navigation.
  const { tenants, error: tenantsError, isLoading: tenantsLoading, refresh: refreshTenants } = useTenants();

  // Refresh tenants on mount to ensure the dropdown reflects any organizations
  // added since the provider first loaded (e.g. after login or navigation).
  useEffect(() => {
    void refreshTenants();
  }, [refreshTenants]);
  const [orgFilter, setOrgFilter] = useState('');

  const [claims, setClaims] = useState<Claim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [skip, setSkip] = useState(0);

  // Selection is a persistent shortlist (not cleared by filter/page changes).
  const [selectedIds, setSelectedIds] = useState<SelectionAmountMap>(new Map());
  // Track full claim objects for selected IDs so we can derive tenant context
  // when no org filter is set (cross-page selection support).
  const [selectedClaimsMap, setSelectedClaimsMap] = useState<Map<string, Claim>>(new Map());

  // Org-scoped "ready for invoicing" set (approved, not yet invoiced).
  const [eligibleClaims, setEligibleClaims] = useState<ClaimOption[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleTotalCount, setEligibleTotalCount] = useState(0);

  const [generateOpen, setGenerateOpen] = useState(false);

  // ── Claim table (oversight, filtered + paginated) ─────────────────────────
  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgFilter) params.set('tenantId', orgFilter);
      if (statusFilter) params.set('status', statusFilter);
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
  }, [orgFilter, statusFilter, searchFilter, dateFrom, dateTo, sortBy, sortOrder, skip]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // ── Eligible claims for the selected org (banner + generate dialog) ───────
  // PA2-A item 5: lowered the org-scoped eligible fetch from `limit=500` to
  // `limit=200`. The server caps at 500 regardless, but a real organization
  // rarely has >200 approved + unbilled claims queued at any moment. The
  // banner (count + OMR total) and the generate-invoice dialog both consume
  // this same payload — the dialog uses it as the multiselect source — so
  // 200 is a defensible, audit-friendly ceiling. When an org exceeds the
  // cap we surface a "showing first 200 — refine filters" hint using
  // `eligibleTotalCount` (server-reported `total`, unaffected by `limit`).
  const ELIGIBLE_FETCH_LIMIT = 200;
  const selectedTenantContext = useMemo(() => {
    const selected = Array.from(selectedClaimsMap.values());
    if (selected.length === 0) return null;
    const tenantIds = new Set(selected.map((c) => c.tenantId));
    if (tenantIds.size > 1) return null;
    const c = selected[0];
    return { tenantId: c.tenantId, tenantName: c.tenantName };
  }, [selectedClaimsMap]);

  const orgName = useMemo(
    () => tenants.find((t) => t.id === orgFilter)?.name ?? selectedTenantContext?.tenantName ?? '',
    [tenants, orgFilter, selectedTenantContext],
  );

  const effectiveTenantId = orgFilter || selectedTenantContext?.tenantId || '';
  useEffect(() => {
    if (!effectiveTenantId) {
      setEligibleClaims([]);
      setEligibleTotalCount(0);
      setEligibleLoading(false);
      return;
    }
    let cancelled = false;
    setEligibleLoading(true);
    fetch(
      `/api/super-admin/reimbursements?status=approved&tenantId=${encodeURIComponent(effectiveTenantId)}&limit=${ELIGIBLE_FETCH_LIMIT}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ClaimsResponse) => {
        if (cancelled) return;
        const eligible: ClaimOption[] = (data.claims ?? [])
          .filter((c) => !c.invoiceId)
          .map((c) => ({
            reimbursementId: c.reimbursementId,
            claimNumber: c.claimNumber ?? null,
            clinicName: c.clinicName ?? null,
            amount: c.amount,
            serviceDate: c.serviceDate ?? null,
            sessionCount: c.sessionCount ?? null,
            invoiceId: c.invoiceId ?? null,
            invoiceNumber: c.invoiceNumber ?? null,
            invoiceStatus: c.invoiceStatus ?? null,
          }));
        setEligibleClaims(eligible);
        // Server returns `total` reflecting the unfiltered-by-limit set; if
        // it exceeds what we paginated, surface a truncation hint.
        setEligibleTotalCount(data.total ?? data.claims?.length ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setEligibleClaims([]);
          setEligibleTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setEligibleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTenantId]);

  const eligibleCount = eligibleClaims.length;
  const eligibleTotal = useMemo(
    () => eligibleClaims.reduce((sum, c) => sum + c.amount, 0),
    [eligibleClaims],
  );

  // ── Selection (shortlist) ─────────────────────────────────────────────────
  const pageEligible = useMemo(
    () =>
      claims.filter((c) =>
        isEligibleForInvoicing(c.status, {
          invoiceId: c.invoiceId ?? null,
          invoiceNumber: c.invoiceNumber ?? null,
          invoiceStatus: c.invoiceStatus ?? null,
        }),
      ),
    [claims],
  );
  const allPageEligibleSelected =
    pageEligible.length > 0 &&
    pageEligible.every((c) => selectedIds.has(c.reimbursementId));

  function toggleClaim(claim: Claim) {
    setSelectedIds(toggleSelection(selectedIds, claim.reimbursementId, claim.amount));
    setSelectedClaimsMap((prev) => {
      const next = new Map(prev);
      if (next.has(claim.reimbursementId)) next.delete(claim.reimbursementId);
      else next.set(claim.reimbursementId, claim);
      return next;
    });
  }

  function togglePageEligible() {
    setSelectedClaimsMap((prevMap) => {
      const nextMap = new Map(prevMap);
      if (allPageEligibleSelected) {
        for (const c of pageEligible) nextMap.delete(c.reimbursementId);
      } else {
        for (const c of pageEligible) nextMap.set(c.reimbursementId, c);
      }
      return nextMap;
    });
    if (allPageEligibleSelected) {
      const next = new Map(selectedIds);
      for (const c of pageEligible) next.delete(c.reimbursementId);
      setSelectedIds(next);
    } else {
      const next = new Map(selectedIds);
      for (const c of pageEligible) next.set(c.reimbursementId, c.amount);
      setSelectedIds(next);
    }
  }

  function handleOrgChange(value: string) {
    // Switching organization is an explicit context change, so the shortlist —
    // which cannot span organizations — is reset rather than silently kept.
    setOrgFilter(value);
    setSelectedIds(clearSelection());
    setSelectedClaimsMap(new Map());
    setSkip(0);
    setStatusFilter('');
  }

  function openGenerate() {
    const tenantId = orgFilter || selectedTenantContext?.tenantId;
    if (!tenantId) return;
    // Auto-select all eligible claims if nothing is manually selected, so the
    // banner's "Generate Invoice" works without requiring manual checkboxes.
    if (shortlistCount === 0) {
      const next = new Map(selectedIds);
      const nextClaimsMap = new Map(selectedClaimsMap);
      for (const c of eligibleClaims) {
        next.set(c.reimbursementId, c.amount);
        nextClaimsMap.set(c.reimbursementId, {
          reimbursementId: c.reimbursementId,
          claimNumber: c.claimNumber ?? undefined,
          tenantId,
          tenantName: orgName,
          employeeName: '',
          clinicName: c.clinicName ?? undefined,
          amount: c.amount,
          description: '',
          serviceDate: c.serviceDate ?? undefined,
          sessionCount: c.sessionCount ?? undefined,
          status: 'approved',
          createdAt: '',
          updatedAt: '',
          invoiceId: null,
          invoiceNumber: null,
          invoiceStatus: null,
        });
      }
      setSelectedIds(next);
      setSelectedClaimsMap(nextClaimsMap);
    }
    setSuccess(null);
    setGenerateOpen(true);
  }

  function handleGenerated(invoice: { invoiceId: string; invoiceNumber: string }) {
    setGenerateOpen(false);
    setSelectedIds(clearSelection());
    setSelectedClaimsMap(new Map());
    // Generate → review → issue. Land on the draft so the operator can issue
    // it. `?created=1` is a one-shot signal that surfaces a "created" banner
    // on the detail page; it is consumed there and does not affect loading.
    router.push(`/invoices/${invoice.invoiceId}?created=1`);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(skip / PAGE_SIZE) + 1;
  const shortlistCount = selectionCount(selectedIds);
  const shortlistTotal = selectionTotal(selectedIds);

  // Distinct tenant count across the authoritative shortlist — drives both
  // the toolbar's disabled reason and the dialog's tenant context.
  const shortlistTenantCount = useMemo(() => {
    return new Set(selectedClaimsMap.values().map((c) => c.tenantId)).size;
  }, [selectedClaimsMap]);

  // Authoritative shortlist as ClaimOption[] — the dialog seeds its internal
  // selection from THIS, never from filtering preselectedIds against the
  // browseable (capped) eligibleClaims list. This guarantees a selected claim
  // is never silently dropped because it fell outside the fetch limit or
  // arrived after the dialog opened.
  const authoritativeSelectedClaims = useMemo<ClaimOption[]>(
    () =>
      Array.from(selectedClaimsMap.values()).map((c) => ({
        reimbursementId: c.reimbursementId,
        claimNumber: c.claimNumber ?? null,
        clinicName: c.clinicName ?? null,
        amount: c.amount,
        serviceDate: c.serviceDate ?? null,
        sessionCount: c.sessionCount ?? null,
        invoiceId: c.invoiceId ?? null,
        invoiceNumber: c.invoiceNumber ?? null,
        invoiceStatus: c.invoiceStatus ?? null,
      })),
    [selectedClaimsMap],
  );

  const toolbarDisabled =
    shortlistCount === 0 || !(orgFilter || selectedTenantContext);
  const toolbarDisabledReason = useMemo(() => {
    if (shortlistCount === 0) return 'Select eligible claims to generate an invoice.';
    if (shortlistTenantCount > 1) {
      return `Invoice generation is limited to one organization at a time. You have selected claims from ${shortlistTenantCount} organizations. Remove claims from the other organization(s) to continue.`;
    }
    return undefined;
  }, [shortlistCount, shortlistTenantCount]);

  return (
    <div className="min-h-screen bg-gray-50">
      <FinancialWorkflowHeader
        icon={<Landmark className="h-6 w-6 text-primary" />}
        iconContainerClass="bg-primary/10"
        title="Claims & Billing"
        subtitle="Bill organizations from approved claims — select, generate, issue, and track to payout."
        actions={
          <button
            onClick={fetchClaims}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <WorkflowStepper current="claims" />
        <WorkspaceSegments active="billing" />

        {/* Organization context — the billing starting point */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1">
              <label
                htmlFor="org-select"
                className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900"
              >
                <Building2 className="h-4 w-4 text-gray-400" />
                Organization
              </label>
              <select
                id="org-select"
                value={orgFilter}
                onChange={(e) => handleOrgChange(e.target.value)}
                disabled={tenantsLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">All organizations</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {tenantsError && (
                <p className="mt-1 text-xs text-red-600">
                  Couldn&apos;t load organizations.{' '}
                  <button
                    onClick={() => void refreshTenants()}
                    className="font-medium text-red-700 underline hover:text-red-800"
                  >
                    Retry
                  </button>
                </p>
              )}
            </div>
            <p className="pb-1 text-xs text-gray-500">
              Billing happens one organization at a time. Select an organization to
              see its ready-to-invoice claims.
            </p>
          </div>
        </div>

        {/* Ready-for-invoicing guidance (org-scoped) */}
        {orgFilter && !eligibleLoading && (
          <FinancialNextAction
            tone={eligibleCount > 0 ? 'success' : 'info'}
            title={
              eligibleCount > 0
                ? 'Ready for billing.'
                : 'Nothing ready to bill.'
            }
            description={
              eligibleCount > 0
                ? `${eligibleCount} approved claim${eligibleCount === 1 ? '' : 's'} (${formatCurrency(eligibleTotal)}) ${eligibleCount === 1 ? 'is' : 'are'} waiting to be billed for ${orgName}.`
                : `No approved, unbilled claims for ${orgName} yet. Approved claims appear here automatically.`
            }
            onAction={
              eligibleCount > 0
                ? { label: 'Generate Invoice', onClick: openGenerate }
                : undefined
            }
          />
        )}
        {/* PA2-A item 5: truncation hint when the org exceeds the eligible
            fetch cap so the operator knows the dialog is showing a subset. */}
        {orgFilter &&
          !eligibleLoading &&
          eligibleTotalCount > eligibleClaims.length && (
            <p className="pb-1 text-xs text-amber-700">
              Showing first {eligibleClaims.length} of {eligibleTotalCount}{' '}
              approved, unbilled claims for {orgName}. Refine filters (date
              range, search) to narrow the list before generating.
            </p>
          )}

        {/* Messages */}
        {success && !loading && <SuccessBanner message={success} />}
        {error && !loading && (
          <FinancialExceptionBanner
            title="Cannot proceed"
            exceptions={[error]}
            onDismiss={() => setError(null)}
          />
        )}

        {/* Filters — find claims; do not conflate with billing */}
        <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
            <input
              type="text"
              placeholder="Claim #, employee…"
              value={searchFilter}
              onChange={(e) => {
                setSearchFilter(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All Status</option>
              {CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLAIM_STATUS_DISPLAY[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <p className="basis-full text-xs text-gray-500">
            Filters narrow the claims you see — they do <span className="font-medium">not</span> auto-select claims for invoicing.
          </p>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as 'createdAt' | 'updatedAt' | 'status');
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="createdAt">Created</option>
              <option value="updatedAt">Updated</option>
              <option value="status">Status</option>
            </select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500">Order</label>
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as 'asc' | 'desc');
                setSkip(0);
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Selection toolbar */}
        <SelectionToolbar
          count={shortlistCount}
          totalAmount={shortlistTotal}
          primaryLabel={`Generate invoice (${shortlistCount})`}
          onPrimary={openGenerate}
          primaryDisabled={toolbarDisabled}
          disabledReason={toolbarDisabledReason}
          onClear={() => { setSelectedIds(clearSelection()); setSelectedClaimsMap(new Map()); }}
          secondaryLabel={allPageEligibleSelected ? 'Clear page eligible' : 'Select all page eligible'}
          onSecondary={togglePageEligible}
          contextHint={orgName ? `for ${orgName}` : undefined}
        />

        {/* Loading */}
        {loading && <FinancialTableSkeleton rows={6} columns={7} />}

        {/* Empty */}
        {!loading && !error && claims.length === 0 && (
          <FinancialEmptyState
            icon={<Search className="h-5 w-5" />}
            title={orgFilter ? `No claims for ${orgName}` : 'No claims match'}
            description="Try adjusting your filters, or select a different organization."
          />
        )}

        {/* Table */}
        {!loading && !error && claims.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageEligibleSelected}
                      onChange={togglePageEligible}
                      aria-label="Select all eligible claims on this page"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Claim #</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Employee</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Clinic</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 md:table-cell">Amount</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Billing</th>
                  <th className="hidden px-4 py-3 font-semibold text-gray-600 lg:table-cell">Age</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => {
                  const eligible = isEligibleForInvoicing(claim.status, {
                    invoiceId: claim.invoiceId ?? null,
                    invoiceNumber: claim.invoiceNumber ?? null,
                    invoiceStatus: claim.invoiceStatus ?? null,
                  });
                  const lastActivity = claim.updatedAt || claim.createdAt;
                  const ageText = relativeTimeShort(lastActivity);
                  const ageTone = relativeAgeTone(lastActivity);
                  return (
                    <tr
                      key={claim.reimbursementId}
                      onClick={() => router.push(`/reimbursements/${claim.reimbursementId}`)}
                      className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(claim.reimbursementId)}
                          disabled={!eligible}
                          onChange={() => toggleClaim(claim)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">
                        {claim.claimNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{claim.tenantName}</td>
                      <td className="px-4 py-3 text-gray-700">{claim.employeeName}</td>
                      <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                        {claim.clinicName ?? '—'}
                      </td>
                      <td className="hidden px-4 py-3 font-medium tabular-nums text-gray-900 md:table-cell">
                        {formatCurrency(claim.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <FinancialStatusBadge
                          label={CLAIM_STATUS_DISPLAY[claim.status]}
                          tone={CLAIM_STATUS_TONE[claim.status]}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <BillingEligibilityBadge
                          status={claim.status}
                          invoiceId={claim.invoiceId ?? null}
                          invoiceNumber={claim.invoiceNumber ?? null}
                          invoiceStatus={claim.invoiceStatus ?? null}
                        />
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span
                          className={`text-xs font-medium ${AGE_TONE_CLASS[ageTone]}`}
                          title={lastActivity}
                        >
                          {ageText}
                        </span>
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
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                disabled={skip <= 0}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="px-2 text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setSkip(Math.min((totalPages - 1) * PAGE_SIZE, skip + PAGE_SIZE))}
                disabled={skip + PAGE_SIZE >= total}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <GenerateInvoiceDialog
        open={generateOpen}
        tenantId={orgFilter || selectedTenantContext?.tenantId || ''}
        tenantName={orgName}
        claims={eligibleClaims}
        authoritativeSelectedClaims={authoritativeSelectedClaims}
        preselectedIds={Array.from(selectedIds.keys())}
        onClose={() => setGenerateOpen(false)}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
