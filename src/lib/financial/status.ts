/**
 * Canonical status metadata for the frozen claim status machine and the invoice
 * lifecycle. Single source of truth for status labels across the financial UI.
 *
 * IMPORTANT — these are read-only labels. The claim status machine
 * (`pending → in_progress → approved → to_be_paid → paid`, with `rejected` and
 * `frozen` side states) is frozen and must not be changed here.
 */

export type ClaimStatus =
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'to_be_paid'
  | 'rejected'
  | 'frozen'
  | 'paid';

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'archived';

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  approved: 'Approved',
  to_be_paid: 'To Be Paid',
  rejected: 'Rejected',
  frozen: 'Frozen',
  paid: 'Paid',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  archived: 'Archived',
};

/**
 * Human-facing display labels — translate the raw machine states into the
 * language an operator reads in the workspace. Kept separate from the
 * canonical `*_LABEL` maps above so the frozen backend enum is never coupled to
 * UI copy.
 *
 *   Approved         → Ready for billing (the Billing column carries the
 *                      "already invoiced" nuance — see eligibility.ts)
 *   To Be Paid       → Ready to pay
 *   Invoice issued   → Awaiting organization payment
 */
export const CLAIM_STATUS_DISPLAY: Record<ClaimStatus, string> = {
  pending: 'Pending',
  in_progress: 'In review',
  approved: 'Approved',
  to_be_paid: 'Ready to pay',
  rejected: 'Rejected',
  frozen: 'Frozen',
  paid: 'Paid',
};

export const INVOICE_STATUS_DISPLAY: Record<InvoiceStatus, string> = {
  draft: 'Ready to send',
  issued: 'Awaiting organization payment',
  paid: 'Paid',
  archived: 'Closed',
};

/**
 * Semantic tone for a status — the single source of truth for status color,
 * so success/warning/danger stay meaningful (never decorative). Purple is
 * intentionally absent: "paid" is a success state, not a highlight.
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const CLAIM_STATUS_TONE: Record<ClaimStatus, StatusTone> = {
  pending: 'neutral',
  in_progress: 'info',
  approved: 'info',
  to_be_paid: 'warning',
  rejected: 'danger',
  frozen: 'info',
  paid: 'success',
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, StatusTone> = {
  draft: 'neutral',
  issued: 'warning',
  paid: 'success',
  archived: 'neutral',
};

/** All claim statuses in a stable order, for filter dropdowns. */
export const CLAIM_STATUSES: ClaimStatus[] = [
  'pending',
  'in_progress',
  'approved',
  'to_be_paid',
  'rejected',
  'frozen',
  'paid',
];
