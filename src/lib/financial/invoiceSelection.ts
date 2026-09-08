/**
 * Bulk selection model for the Invoices workspace.
 *
 * Pure helpers (no React) so they can be unit-tested — the invoice-side
 * counterpart of `selection.ts` from the Claims billing workflow.
 *
 * Design rules (bulk invoice audit, Sections 5–8):
 *  - Bulk issue/archive are gated per invoice by the same state rules the
 *    individual workflow enforces (draft→issued, paid→archived).
 *  - A PDF package is an ORGANIZATION deliverable: it must never combine
 *    invoices from more than one organization.
 *  - The package is a delivery convenience only — never a financial document.
 */

import type { InvoiceStatus } from './status';
import { INVOICE_STATUS_DISPLAY } from './status';

export interface BulkSelectableInvoice {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  status: InvoiceStatus;
  totalAmount: number;
}

export function toggleInvoiceSelection(ids: string[], invoiceId: string): string[] {
  return ids.includes(invoiceId)
    ? ids.filter((id) => id !== invoiceId)
    : [...ids, invoiceId];
}

/** Adds every id on the current page to the selection (idempotent). */
export function selectPageInvoices(visibleIds: string[], current: string[]): string[] {
  return [...new Set([...current, ...visibleIds])];
}

/** Removes every id on the current page from the selection. */
export function deselectPageInvoices(visibleIds: string[], current: string[]): string[] {
  const remove = new Set(visibleIds);
  return current.filter((id) => !remove.has(id));
}

export function selectedInvoices<T extends BulkSelectableInvoice>(
  invoices: T[],
  ids: string[],
): T[] {
  const wanted = new Set(ids);
  return invoices.filter((invoice) => wanted.has(invoice.invoiceId));
}

export function distinctOrgCount(invoices: BulkSelectableInvoice[]): number {
  return new Set(invoices.map((invoice) => invoice.tenantId)).size;
}

export function sumTotal(invoices: BulkSelectableInvoice[]): number {
  return invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
}

export interface BulkTransitionRejection {
  invoice: BulkSelectableInvoice;
  reason: string;
}

export interface BulkTransitionPlan {
  /** Invoices whose current status permits the transition. */
  eligible: BulkSelectableInvoice[];
  /** Invoices that would be rejected, with the human-facing reason. */
  ineligible: BulkTransitionRejection[];
}

/**
 * Plans a bulk transition (issue / archive) over the selection. The plan is
 * advisory only — the backend re-validates every invoice individually; this
 * exists so the toolbar can show only actions valid for the exact selection
 * and explain why a mixed selection cannot run a given action.
 */
export function planBulkTransition(
  invoices: BulkSelectableInvoice[],
  fromStatuses: InvoiceStatus[],
  actionLabel: string,
): BulkTransitionPlan {
  const eligible = invoices.filter((invoice) => fromStatuses.includes(invoice.status));
  const expected = fromStatuses.map((s) => `“${INVOICE_STATUS_DISPLAY[s]}”`).join(' or ');
  const ineligible = invoices
    .filter((invoice) => !fromStatuses.includes(invoice.status))
    .map((invoice) => ({
      invoice,
      reason: `${actionLabel} requires ${expected} — ${invoice.invoiceNumber} is “${INVOICE_STATUS_DISPLAY[invoice.status]}”.`,
    }));
  return { eligible, ineligible };
}

export interface InvoicePackagePlan {
  ok: boolean;
  /** Why packaging is blocked (empty selection / mixed organizations). */
  reason?: string;
  orgId?: string;
  invoices: BulkSelectableInvoice[];
  total: number;
}

/**
 * Plans an organization-scoped invoice package. Packaging across
 * organizations is refused — one package, one organization.
 */
export function planInvoicePackage(
  invoices: BulkSelectableInvoice[],
): InvoicePackagePlan {
  if (invoices.length === 0) {
    return { ok: false, reason: 'No invoices selected.', invoices: [], total: 0 };
  }
  if (distinctOrgCount(invoices) > 1) {
    return {
      ok: false,
      reason:
        'Selected invoices belong to multiple organizations. A package covers one organization at a time — clear the selection and select invoices for a single organization.',
      invoices: [],
      total: 0,
    };
  }
  return {
    ok: true,
    orgId: invoices[0].tenantId,
    invoices,
    total: sumTotal(invoices),
  };
}