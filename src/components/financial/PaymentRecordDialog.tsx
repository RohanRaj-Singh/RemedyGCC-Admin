'use client';

// ── Payment Record Dialog ───────────────────────────────────────────────────
// Reusable confirmation dialog used by the Super Admin's Payments workspace
// to *record* clinic payments — i.e. mark claims as `paid` after the bank
// transfer has already happened externally.
//
// IMPORTANT: This dialog never *performs* a bank transfer. The financial flow
// per the verified state machine is:
//   Super Admin reviews payment → Payment occurs externally → Super Admin
//   records payment here → Claim becomes Paid.
//
// The dialog shows every claim's full context (employee, organization, clinic,
// claim number, amount, bank details, funding invoice) before asking the
// operator to confirm, and captures the operator-entered fields for the ledger:
// payment date (the actual transfer date, NOT forced to today), method,
// bank/transfer reference, and notes.
//
// Duplicate-payment protection: any claim whose id repeats in the selection,
// or whose PaymentRecord already shows `status === "paid"`, is surfaced as a
// strong warning — but the operator may still "Continue Anyway" (never silently
// blocked).

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, Loader2, X, CalendarDays, Hash, Landmark,
  FileText, ShieldCheck, Building2, User, StickyNote, CreditCard,
} from 'lucide-react';
import { findDuplicateClaimIds, findAlreadyPaid } from '@/lib/financial/payout';

export interface PaymentRecordClaim {
  /** Claim ID (reimbursementId). */
  claimId: string;
  claimNumber?: string;
  employeeName: string;
  orgName: string;
  clinicName: string | null;
  amount: number;
  /** Effective bank snapshot (claim's own bank details — the sole source of truth). */
  effectiveBankAccountNumber?: string;
  effectiveBankName?: string;
  /** Funding invoice linkage (set when claim auto-queued by markInvoicePaid). */
  invoiceId?: string;
  invoiceNumber?: string;
  serviceDate?: string;
}

/** Operator-entered fields captured on the finalized PaymentRecord. */
export interface PaymentRecordFields {
  paymentDate: string;
  method: string;
  bankReference: string;
  notes: string;
}

interface PaymentRecordDialogProps {
  open: boolean;
  /** Claims to record payment for. */
  claims: PaymentRecordClaim[];
  /** Total amount across the selection (display only — `claims` is the source of truth). */
  totalAmount: number;
  /** Claim IDs that already have a paid ledger record (duplicate-payment protection). */
  paidClaimIds?: ReadonlySet<string>;
  /** Callback fired on confirm. Receives the operator-entered fields. */
  onConfirm: (fields: PaymentRecordFields) => Promise<void> | void;
  /** Callback fired when the dialog is dismissed. */
  onCancel: () => void;
}

function formatCurrency(amount: number) {
  return `OMR ${amount.toFixed(3)}`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PaymentRecordDialog({
  open, claims, totalAmount, paidClaimIds, onConfirm, onCancel,
}: PaymentRecordDialogProps) {
  const [paymentDate, setPaymentDate] = useState('');
  const [method, setMethod] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the dialog is (re-)opened.
  useEffect(() => {
    if (open) {
      setPaymentDate('');
      setMethod('');
      setBankReference('');
      setNotes('');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  // Duplicate-payment protection (defensive — never a silent block).
  const duplicateIds = useMemo(
    () => findDuplicateClaimIds(claims.map((c) => c.claimId)),
    [claims],
  );
  const alreadyPaid = useMemo(
    () => findAlreadyPaid(claims.map((c) => c.claimId), paidClaimIds ?? new Set<string>()),
    [claims, paidClaimIds],
  );
  const hasWarnings = duplicateIds.length > 0 || alreadyPaid.length > 0;

  // Group claims by org + invoice + bank + clinic so operators see one row per
  // payout cohort, not N rows for N claims.
  const grouped = useMemo(() => {
    const map = new Map<string, {
      key: string;
      invoiceNumber?: string;
      invoiceId?: string;
      bankName?: string;
      bankAccountNumber?: string;
      claims: PaymentRecordClaim[];
      totalAmount: number;
    }>();
    for (const c of claims) {
      const key = `${c.orgName}::${c.invoiceId ?? 'no-invoice'}::${c.effectiveBankAccountNumber ?? 'no-bank'}::${c.clinicName ?? 'no-clinic'}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          invoiceNumber: c.invoiceNumber,
          invoiceId: c.invoiceId,
          bankName: c.effectiveBankName,
          bankAccountNumber: c.effectiveBankAccountNumber,
          claims: [],
          totalAmount: 0,
        };
        map.set(key, g);
      }
      g.claims.push(c);
      g.totalAmount += c.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [claims]);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        paymentDate: paymentDate.trim(),
        method: method.trim(),
        bankReference: bankReference.trim(),
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recording payment failed.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-record-title"
      data-testid="payment-record-dialog"
    >
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
            </span>
            <div className="min-w-0">
              <h2 id="payment-record-title" className="text-lg font-bold text-gray-900">
                Record clinic payment
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Confirm context before recording. The actual bank transfer happens outside this system.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close dialog"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="max-h-[calc(92vh-170px)] overflow-y-auto px-6 py-5">
          {/* Summary */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">
                Recording payment for{' '}
                <span className="text-emerald-700">
                  {claims.length} claim{claims.length === 1 ? '' : 's'}
                </span>
              </p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
            </div>
          </div>

          {claims.length === 0 ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No claims are ready to record. Resolve missing bank details or pick a different selection.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {grouped.map((g) => (
                <div key={g.key} className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Payout group · {g.claims.length} claim{g.claims.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(g.totalAmount)}</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {/* Bank + Invoice context (one row per group, since these are constant) */}
                    <dl className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <Landmark className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Bank</dt>
                          <dd className="text-xs text-gray-900 truncate">
                            {g.bankName ?? '—'}{g.bankAccountNumber ? ` · ${g.bankAccountNumber}` : ''}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Funded by</dt>
                          <dd className="text-xs text-gray-900 truncate">
                            {g.invoiceNumber ? (
                              <a
                                href={g.invoiceId ? `/invoices/${g.invoiceId}` : '/invoices'}
                                className="font-mono text-blue-600 hover:text-blue-800"
                                title="Open funding invoice"
                              >
                                {g.invoiceNumber}
                              </a>
                            ) : (
                              <span className="text-gray-400">No invoice linked</span>
                            )}
                          </dd>
                        </div>
                      </div>
                    </dl>
                    {/* Per-claim rows */}
                    <ul className="divide-y divide-gray-100 bg-white">
                      {g.claims.map((c) => (
                        <li key={c.claimId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-900 min-w-0">
                            <Hash className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <a
                              href={`/reimbursements/${c.claimId}`}
                              className="font-mono text-blue-600 hover:text-blue-800 truncate"
                              title="Open claim"
                            >
                              {c.claimNumber ?? c.claimId}
                            </a>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{c.employeeName}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{c.clinicName ?? 'No Clinic'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 min-w-0">
                            <Landmark className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{c.orgName}</span>
                          </span>
                          {c.serviceDate && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <CalendarDays className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                              {formatDate(c.serviceDate)}
                            </span>
                          )}
                          <span className="ml-auto text-sm font-semibold text-gray-900">
                            {formatCurrency(c.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Operator-entered fields for the ledger */}
          {claims.length > 0 && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="payment-date" className="mb-1 block text-xs font-medium text-gray-600">
                  Payment date{' '}
                  <span className="font-normal text-gray-400">(actual transfer date — required)</span>
                </label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    disabled={submitting}
                    data-testid="payment-date-input"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="payment-method" className="mb-1 block text-xs font-medium text-gray-600">
                  Payment method{' '}
                  <span className="font-normal text-gray-400">(e.g. Bank transfer)</span>
                </label>
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="payment-method"
                    type="text"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    placeholder="e.g. Bank transfer"
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    disabled={submitting}
                    data-testid="payment-method-input"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="payment-bank-ref" className="mb-1 block text-xs font-medium text-gray-600">
                  Bank / transfer reference{' '}
                  <span className="font-normal text-gray-400">(optional — recorded for reconciliation)</span>
                </label>
                <input
                  id="payment-bank-ref"
                  type="text"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder="e.g. TRF-2026-08-12345"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  disabled={submitting}
                  data-testid="payment-bank-ref-input"
                />
              </div>
              <div>
                <label htmlFor="payment-notes" className="mb-1 block text-xs font-medium text-gray-600">
                  Notes{' '}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <div className="relative">
                  <StickyNote className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <textarea
                    id="payment-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional internal note for this payout"
                    rows={2}
                    className="w-full resize-y rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    disabled={submitting}
                    data-testid="payment-notes-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Duplicate-payment warning (strong warning + continue-anyway override) */}
          {hasWarnings && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Duplicate-payment warning</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
                  {duplicateIds.length > 0 && (
                    <li>
                      {duplicateIds.length} claim id{duplicateIds.length === 1 ? '' : 's'} appear{duplicateIds.length === 1 ? 's' : ''} more than once in this selection.
                    </li>
                  )}
                  {alreadyPaid.length > 0 && (
                    <li>
                      {alreadyPaid.length} claim{alreadyPaid.length === 1 ? '' : 's'} already have a paid record on the ledger.
                    </li>
                  )}
                </ul>
                <p className="mt-1 text-xs">
                  Recording will still proceed for every selected claim. Review carefully before continuing.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-700">What this action does</p>
            <p className="mt-1">
              Marks {claims.length === 1 ? 'this claim' : 'these claims'} as <span className="font-semibold">paid</span>{' '}
              and finalizes a permanent PaymentRecord ledger entry with the payment date, method, reference, and
              notes supplied above. This is the final step of the financial workflow and cannot be undone from this UI.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || claims.length === 0}
            data-testid="payment-record-confirm"
            className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              hasWarnings ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            {submitting
              ? 'Recording…'
              : hasWarnings
                ? 'Continue Anyway'
                : claims.length === 1
                  ? 'Mark Paid'
                  : `Mark ${claims.length} Paid`}
          </button>
        </div>
      </div>
    </div>
  );
}
