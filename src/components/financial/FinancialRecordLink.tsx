'use client';

// ── Financial record link ───────────────────────────────────────────────────
// Compact contextual link to a related financial record (invoice, claim,
// payment). Used inline in timelines, summary cards, and next-action banners
// so the user can pivot from one financial record to its linked counterpart
// without needing the sidebar Invoices entry.
//
// Variants:
//   "invoice" — links to /invoices/[id]
//   "claim"   — links to /reimbursements/[id]
//   "payment" — links to /payments/[claimId]
//
// The link renders the human-readable reference (invoice number, claim number,
// payment reference) plus the appropriate Lucide icon. If the reference is
// missing, the component renders a muted placeholder rather than a broken link.

import { FileText, Receipt, Banknote } from 'lucide-react';

export type FinancialRecordKind = 'invoice' | 'claim' | 'payment';

interface FinancialRecordLinkProps {
  kind: FinancialRecordKind;
  href?: string;
  /** Human-readable identifier (invoice number, claim number, payment ref). */
  reference?: string | null;
  /** Optional secondary text, e.g. amount or status. */
  secondary?: string;
  className?: string;
}

const ICONS = {
  invoice: FileText,
  claim: Receipt,
  payment: Banknote,
} as const;

export default function FinancialRecordLink({
  kind, href, reference, secondary, className = '',
}: FinancialRecordLinkProps) {
  const Icon = ICONS[kind];
  const label =
    reference && reference.trim().length > 0
      ? reference
      : (kind === 'invoice' ? 'No invoice' : kind === 'claim' ? 'No claim' : 'No payment');

  if (!href) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
        {secondary ? <span className="text-gray-400">· {secondary}</span> : null}
      </span>
    );
  }

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-900 px-1.5 py-0.5 ${className}`}
      title={`Open ${kind} ${reference ?? ''}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-mono">{label}</span>
      {secondary ? <span className="text-gray-500 font-sans">· {secondary}</span> : null}
    </a>
  );
}