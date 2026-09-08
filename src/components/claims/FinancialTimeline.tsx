'use client';

// ── Financial timeline ──────────────────────────────────────────────────────
// Renders the payment-pipeline milestones for a claim in the Super Admin's
// financial-operations model:
//
//   Approved → Added to Invoice → Invoice Issued → Org Payment Recorded →
//   Queued for Payment → Paid
//
// The component derives milestones from the claim's append-only history (each
// history entry carries the status + timestamp). It deliberately surfaces only
// the *financial* pipeline, not the full review workflow — that remains on the
// ClaimTimeline component.
//
// Phase B (2026-08-20): expanded to include invoice-side milestones when an
// `invoiceId` is present on the claim (populated server-side when the claim is
// auto-queued by `markInvoicePaid`). When the claim has no invoice linkage yet,
// the invoice-side milestones render as "Pending" — never as "skipped".

interface HistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

interface FinancialTimelineProps {
  history?: HistoryEntry[];
  /** Funding invoice linkage (present after invoice is generated). */
  invoiceId?: string;
  invoiceNumber?: string;
}

interface Milestone {
  key: string;
  label: string;
  date?: string;
  done: boolean;
  icon: string;
  /** Optional link to contextual record (e.g. the funding invoice). */
  href?: string;
}

function formatDate(iso: string | undefined) {
  if (!iso) return 'Pending';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Find the timestamp of the first history entry that reached a given status.
 * History is append-only and ordered, so the first match is the transition time.
 */
function firstReached(history: HistoryEntry[], status: string): string | undefined {
  const entry = history?.find((h) => h.status === status);
  return entry?.timestamp;
}

/**
 * Try to detect an invoice-related milestone from history notes. The
 * `markInvoicePaid` integration records history entries with note containing
 * the invoice number, e.g. "Invoice INV-2026-000123 paid by Acme. Auto-queued
 * for clinic payout." When we see such an entry, we use its timestamp as the
 * "Org Payment Recorded" milestone; the matching "Invoice Issued" milestone is
 * derived from when the invoice was linked (the first non-paid transition).
 */
function findOrgPaymentAt(history: HistoryEntry[]): string | undefined {
  // Org payment recorded fires when the claim transitions to to_be_paid via
  // markInvoicePaid — that history entry's status is "to_be_paid".
  const queued = history?.find(
    (h) => h.status === 'to_be_paid' && h.note && /invoice/i.test(h.note),
  );
  if (queued) return queued.timestamp;
  // Fallback: any to_be_paid transition is "Org Payment Recorded".
  return firstReached(history, 'to_be_paid');
}

export default function FinancialTimeline({ history, invoiceId, invoiceNumber }: FinancialTimelineProps) {
  if (!history || history.length === 0) return null;

  const approvedAt = firstReached(history, 'approved');
  // "Added to Invoice" milestone: first time the claim appeared on an invoice
  // line item. We approximate it by the history note that mentions "Invoice
  // INV-... generated" — present from generateInvoice() when the claim is
  // first included on an invoice draft.
  const addedToInvoiceAt = history?.find(
    (h) => h.note && /invoice\s+inv-/i.test(h.note) && /generated|draft/i.test(h.note),
  )?.timestamp;
  const invoiceIssuedAt = history?.find(
    (h) => h.note && /invoice\s+inv-/i.test(h.note) && /issued/i.test(h.note),
  )?.timestamp;
  const orgPaymentAt = findOrgPaymentAt(history);
  const queuedAt = firstReached(history, 'to_be_paid');
  const paidAt = firstReached(history, 'paid');

  const invoiceHref = invoiceId ? `/invoices/${invoiceId}` : undefined;

  const milestones: Milestone[] = [
    {
      key: 'approved', label: 'Claim Approved', date: approvedAt, done: Boolean(approvedAt),
      icon: '✓',
    },
    {
      key: 'added_to_invoice', label: invoiceNumber ? `Added to ${invoiceNumber}` : 'Added to Invoice',
      date: addedToInvoiceAt, done: Boolean(addedToInvoiceAt), icon: '+', href: invoiceHref,
    },
    {
      key: 'invoice_issued', label: 'Invoice Issued',
      date: invoiceIssuedAt, done: Boolean(invoiceIssuedAt), icon: '↑', href: invoiceHref,
    },
    {
      key: 'org_payment', label: 'Organization Payment Recorded',
      date: orgPaymentAt, done: Boolean(orgPaymentAt), icon: '◆', href: invoiceHref,
    },
    {
      key: 'queued', label: 'Queued for Payout', date: queuedAt, done: Boolean(queuedAt), icon: '≫',
    },
    {
      key: 'paid', label: 'Paid to Clinic', date: paidAt, done: Boolean(paidAt), icon: '✓',
    },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Financial Timeline
      </h3>
      <ol className="space-y-0">
        {milestones.map((m, i) => {
          const content = (
            <>
              <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                m.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
              }`}>
                {m.done ? m.icon : '·'}
              </span>
              <div className="pt-0.5">
                <p className={`text-sm font-medium ${m.done ? 'text-gray-900' : 'text-gray-400'}`}>{m.label}</p>
                <p className="text-xs text-gray-500">{formatDate(m.date)}</p>
              </div>
            </>
          );
          return (
            <li key={m.key} className="relative flex items-start gap-3 pb-5">
              {i < milestones.length - 1 && (
                <span className={`absolute left-[13px] top-6 h-full w-px ${m.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
              {m.href && m.done ? (
                <a href={m.href} className="flex items-start gap-3 hover:opacity-80" title={`Open ${invoiceNumber ?? 'invoice'}`}>
                  {content}
                </a>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}