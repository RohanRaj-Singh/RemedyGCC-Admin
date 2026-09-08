import type { ClaimStatus } from './status';

/**
 * Billing eligibility — the pure derivation of where a claim sits in the
 * Claims → Invoice → Payment workflow, from its status + invoice relationship.
 *
 * The relationship ("Invoiced") is NEVER a claim status. It is derived at read
 * time from invoice line items (Phase 2 `getClaimInvoiceLinks`) and surfaced on
 * the claim payload as `invoiceId` / `invoiceNumber` / `invoiceStatus`.
 *
 * Invoicing eligibility is: `status === "approved"` AND not referenced by any
 * invoice (draft / issued / paid / archived).
 */

export interface ClaimInvoiceLink {
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null; // draft | issued | paid | archived | null
}

export type BillingEligibility =
  | 'ready_for_invoicing'
  | 'invoiced_draft'
  | 'invoiced_issued'
  | 'invoiced_paid'
  | 'invoiced_archived'
  | 'ready_for_payout'
  | 'paid'
  | 'not_eligible';

export interface BillingEligibilityMeta {
  key: BillingEligibility;
  label: string;
  description: string;
  /** Whether the claim can be selected onto a new invoice right now. */
  selectable: boolean;
}

const META: Record<BillingEligibility, Omit<BillingEligibilityMeta, 'key'>> = {
  ready_for_invoicing: {
    label: 'Ready for billing',
    description: 'Approved and not yet on an invoice.',
    selectable: true,
  },
  invoiced_draft: {
    label: 'On a draft invoice',
    description: 'Already selected on a draft invoice.',
    selectable: false,
  },
  invoiced_issued: {
    label: 'Awaiting organization payment',
    description: 'Invoiced and awaiting the organization to pay.',
    selectable: false,
  },
  invoiced_paid: {
    label: 'Invoice paid',
    description: 'Funded by a paid invoice.',
    selectable: false,
  },
  invoiced_archived: {
    label: 'On an archived invoice',
    description: 'Included on an archived invoice.',
    selectable: false,
  },
  ready_for_payout: {
    label: 'Ready for clinic payout',
    description: 'Queued for payout in the Payments workspace.',
    selectable: false,
  },
  paid: {
    label: 'Paid',
    description: 'Paid out to the employee.',
    selectable: false,
  },
  not_eligible: {
    label: 'Not eligible',
    description: 'Not yet approved for invoicing.',
    selectable: false,
  },
};

/** True when the claim can be selected onto a new invoice right now. */
export function isEligibleForInvoicing(status: ClaimStatus, link: ClaimInvoiceLink): boolean {
  return status === 'approved' && !link.invoiceId;
}

export function billingEligibility(
  status: ClaimStatus,
  link: ClaimInvoiceLink,
): BillingEligibility {
  if (status === 'paid') return 'paid';
  if (status === 'to_be_paid') return 'ready_for_payout';
  if (status === 'approved') {
    if (!link.invoiceId) return 'ready_for_invoicing';
    switch (link.invoiceStatus) {
      case 'paid':
        return 'invoiced_paid';
      case 'issued':
        return 'invoiced_issued';
      case 'archived':
        return 'invoiced_archived';
      case 'draft':
      default:
        return 'invoiced_draft';
    }
  }
  return 'not_eligible';
}

export function billingEligibilityMeta(
  status: ClaimStatus,
  link: ClaimInvoiceLink,
): BillingEligibilityMeta {
  const key = billingEligibility(status, link);
  return { key, ...META[key] };
}
