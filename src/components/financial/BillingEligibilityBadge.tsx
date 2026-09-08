'use client';

import Link from 'next/link';
import { AlertCircle, Banknote, CheckCircle2, Clock, FileText } from 'lucide-react';
import {
  billingEligibilityMeta,
  type BillingEligibility,
} from '@/lib/financial/eligibility';
import type { ClaimStatus } from '@/lib/financial/status';

const TONE: Record<BillingEligibility, string> = {
  ready_for_invoicing: 'bg-emerald-100 text-emerald-800',
  invoiced_draft: 'bg-gray-100 text-gray-700',
  invoiced_issued: 'bg-blue-100 text-blue-800',
  invoiced_paid: 'bg-emerald-100 text-emerald-800',
  invoiced_archived: 'bg-gray-100 text-gray-700',
  ready_for_payout: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  not_eligible: 'bg-gray-100 text-gray-500',
};

function Icon({ kind }: { kind: BillingEligibility }) {
  switch (kind) {
    case 'ready_for_invoicing':
    case 'invoiced_paid':
    case 'paid':
      return <CheckCircle2 className="h-3 w-3" />;
    case 'invoiced_draft':
    case 'invoiced_archived':
      return <FileText className="h-3 w-3" />;
    case 'invoiced_issued':
      return <Clock className="h-3 w-3" />;
    case 'ready_for_payout':
      return <Banknote className="h-3 w-3" />;
    case 'not_eligible':
      return <AlertCircle className="h-3 w-3" />;
  }
}

interface BillingEligibilityBadgeProps {
  status: ClaimStatus;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceStatus: string | null;
}

/**
 * Renders where a claim sits in the billing workflow WITHOUT inventing a fake
 * claim status. When the claim is already on an invoice, the invoice number is
 * shown alongside and links through to that invoice.
 */
export default function BillingEligibilityBadge({
  status,
  invoiceId,
  invoiceNumber,
  invoiceStatus,
}: BillingEligibilityBadgeProps) {
  const meta = billingEligibilityMeta(status, { invoiceId, invoiceNumber, invoiceStatus });
  const pill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[meta.key]}`}
      title={meta.description}
    >
      <Icon kind={meta.key} />
      {meta.label}
    </span>
  );

  if (invoiceId && meta.key.startsWith('invoiced_')) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Link
          href={`/invoices/${invoiceId}`}
          className="font-mono text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
        >
          {invoiceNumber ?? 'Invoice'}
        </Link>
        {pill}
      </span>
    );
  }
  return pill;
}
