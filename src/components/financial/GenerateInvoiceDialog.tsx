'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Loader2, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/financial/format';
import {
  buildGenerateRequest,
  buildInvoiceReviewSummary,
  type InvoiceReviewSummary,
} from '@/lib/financial/invoice';
import { clearIds, selectAllIds, toggleId } from '@/lib/financial/selection';

export interface ClaimOption {
  reimbursementId: string;
  claimNumber?: string | null;
  clinicName?: string | null;
  amount: number;
  serviceDate?: string | null;
  sessionCount?: number | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

interface GenerateInvoiceDialogProps {
  open: boolean;
  tenantId: string;
  tenantName: string;
  /** The org's eligible claims (approved, not yet invoiced). Browseable source. */
  claims: ClaimOption[];
  /**
   * The operator's authoritative shortlist — the exact claims they selected on
   * the Claims workspace. The dialog seeds its internal selection from THIS
   * list, never from filtering `preselectedIds` against the browseable
   * `claims`. This guarantees a selected claim is never silently dropped
   * because it fell outside the eligible-claims fetch limit or because the
   * browseable list arrived after the dialog opened.
   */
  authoritativeSelectedClaims: ClaimOption[];
  /** Legacy alias kept for backwards-compat with any external callers. */
  preselectedIds?: string[];
  onClose: () => void;
  onGenerated: (invoice: { invoiceId: string; invoiceNumber: string }) => void;
}

/**
 * Pre-generation review. The operator confirms the organization, the exact
 * claims to bill, and the running total BEFORE a draft invoice is created.
 * Selection is authoritative: only eligible claims (approved, not invoiced) are
 * selectable, and the backend re-validates atomically at generate time.
 */
export default function GenerateInvoiceDialog({
  open,
  tenantId,
  tenantName,
  claims,
  authoritativeSelectedClaims,
  preselectedIds = [],
  onClose,
  onGenerated,
}: GenerateInvoiceDialogProps) {
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The authoritative shortlist is the single source of truth for what the
  // operator selected on the Claims workspace. Seed the dialog's internal
  // selection from it on every open AND whenever the authoritative list
  // changes (e.g. the browseable `claims` fetch resolved after the dialog
  // already opened). Filtering `preselectedIds` against the browseable
  // `claims` list would silently drop claims that fall outside the fetch
  // limit or arrived late — this guarantees they stay selected.
  const authoritativeKey = authoritativeSelectedClaims
    .map((c) => c.reimbursementId)
    .sort()
    .join('|');
  useEffect(() => {
    if (!open) return;
    const seeded = authoritativeSelectedClaims.map((c) => c.reimbursementId);
    setSelectedClaimIds(seeded);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, authoritativeKey]);

  // Merge the browseable list with the authoritative shortlist so claims the
  // operator already selected (even those outside the fetch cap) are always
  // visible and selectable inside the dialog.
  const visibleClaims = useMemo(() => {
    const byId = new Map<string, ClaimOption>();
    for (const c of claims) byId.set(c.reimbursementId, c);
    for (const c of authoritativeSelectedClaims) {
      if (!byId.has(c.reimbursementId)) byId.set(c.reimbursementId, c);
    }
    return Array.from(byId.values());
  }, [claims, authoritativeSelectedClaims]);

  const selectedClaims = useMemo(
    () => visibleClaims.filter((c) => selectedClaimIds.includes(c.reimbursementId)),
    [visibleClaims, selectedClaimIds],
  );

  const review: InvoiceReviewSummary = useMemo(
    () => buildInvoiceReviewSummary(tenantId, tenantName, selectedClaims),
    [tenantId, tenantName, selectedClaims],
  );

  if (!open) return null;

  const allSelected = visibleClaims.length > 0 && selectedClaimIds.length === visibleClaims.length;

  async function handleGenerate() {
    if (!tenantId) {
      setError('Select an organization first.');
      return;
    }
    if (selectedClaimIds.length === 0) {
      setError('Select at least one claim to invoice.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGenerateRequest(tenantId, selectedClaimIds)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not generate the invoice.');
        return;
      }
      const created = await res.json();
      onGenerated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Generate invoice"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Generate Invoice</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {authoritativeSelectedClaims.length > 0
                ? `${authoritativeSelectedClaims.length} claim${authoritativeSelectedClaims.length === 1 ? '' : 's'} selected for ${tenantName}. Review and adjust before generating.`
                : 'Select the claims to bill for this organization.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Organization context */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{tenantName}</span>
          <span className="font-mono text-xs text-gray-400">{tenantId}</span>
        </div>

        {/* Claim selection */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Eligible claims ({visibleClaims.length})
              {authoritativeSelectedClaims.length > 0 && authoritativeSelectedClaims.some((c) => !claims.some((b) => b.reimbursementId === c.reimbursementId)) && (
                <span className="ml-2 text-amber-600 normal-case">
                  · {authoritativeSelectedClaims.filter((c) => !claims.some((b) => b.reimbursementId === c.reimbursementId)).length} from shortlist
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setSelectedClaimIds(allSelected ? clearIds() : selectAllIds(visibleClaims.map((c) => c.reimbursementId)))}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {allSelected ? 'Clear all' : 'Select all eligible'}
            </button>
          </div>

          {visibleClaims.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
              No approved, unbilled claims for this organization.
            </p>
          ) : (
            <div className="max-h-72 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-200">
              {visibleClaims.map((claim) => {
                const checked = selectedClaimIds.includes(claim.reimbursementId);
                return (
                  <label
                    key={claim.reimbursementId}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedClaimIds(toggleId(selectedClaimIds, claim.reimbursementId))}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-900">
                          {claim.claimNumber ?? claim.reimbursementId}
                        </span>
                        {claim.clinicName && (
                          <span className="truncate text-xs text-gray-500">{claim.clinicName}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(claim.serviceDate)}
                        {claim.sessionCount != null ? ` · ${claim.sessionCount} sessions` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums text-gray-900">
                      {formatCurrency(claim.amount)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Review summary */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>
                {review.claimCount} claim{review.claimCount === 1 ? '' : 's'} · {review.clinicCount}{' '}
                clinic{review.clinicCount === 1 ? '' : 's'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400">Draft total</span>
              <p className="text-base font-bold tabular-nums text-gray-900">
                {formatCurrency(review.totalAmount)}
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || selectedClaimIds.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
