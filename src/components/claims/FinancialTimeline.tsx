'use client';

// ── Financial timeline ──────────────────────────────────────────────────────
// Renders the payment-pipeline milestones for a claim in the Super Admin's
// financial-operations model:
//
//   Approved → Queued for Payment → Paid
//
// The component derives milestones from the claim's append-only history (each
// history entry carries the status + timestamp). It deliberately surfaces only
// the *financial* pipeline, not the full review workflow — that remains on the
// ClaimTimeline component.
//
// Extension point: when invoice linkage lands on the claim (invoiceId /
// invoiceIssuedAt), add an "Invoice Issued" / "Org Payment Received" milestone
// between Approved and Queued without changing this contract.

interface HistoryEntry {
  status: string;
  timestamp: string;
}

interface FinancialTimelineProps {
  history?: HistoryEntry[];
}

interface Milestone {
  key: string;
  label: string;
  date?: string;
  done: boolean;
  icon: string;
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

export default function FinancialTimeline({ history }: FinancialTimelineProps) {
  if (!history || history.length === 0) return null;

  const approvedAt = firstReached(history, 'approved');
  const queuedAt = firstReached(history, 'to_be_paid');
  const paidAt = firstReached(history, 'paid');

  const milestones: Milestone[] = [
    { key: 'approved', label: 'Claim Approved', date: approvedAt, done: Boolean(approvedAt), icon: '✓' },
    { key: 'queued', label: 'Queued for Payment', date: queuedAt, done: Boolean(queuedAt), icon: '≫' },
    { key: 'paid', label: 'Paid', date: paidAt, done: Boolean(paidAt), icon: '✓' },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
        Financial Timeline
      </h3>
      <ol className="space-y-0">
        {milestones.map((m, i) => (
          <li key={m.key} className="relative flex items-start gap-3 pb-5">
            {i < milestones.length - 1 && (
              <span className={`absolute left-[13px] top-6 h-full w-px ${m.done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
            <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              m.done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {m.done ? m.icon : '·'}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-medium ${m.done ? 'text-gray-900' : 'text-gray-400'}`}>{m.label}</p>
              <p className="text-xs text-gray-500">{formatDate(m.date)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
