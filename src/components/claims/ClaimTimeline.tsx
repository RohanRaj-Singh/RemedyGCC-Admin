'use client';

// ── Claim History timeline ──────────────────────────────────────────────────
// Shared renderer for the claim's append-only history (status changes, reviewer
// notes, progress updates, resubmissions). Used by the super-admin claim detail page.

interface ClaimHistoryEntry {
  status: string;
  actorId: string;
  actorRole: 'employee' | 'tenantAdmin';
  note?: string;
  timestamp: string;
}

interface ClaimTimelineProps {
  history?: ClaimHistoryEntry[];
  employeeLabel?: string;
  reviewerLabel?: string;
  showActorId?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function statusLabel(status: string) {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function ClaimTimeline({
  history,
  employeeLabel = 'Employee',
  reviewerLabel = 'Reviewer',
  showActorId = false,
}: ClaimTimelineProps) {
  if (!history || history.length === 0) return null;

  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-4">
      {history.map((entry, i) => (
        <li key={i} className="pl-5 relative">
          <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white ${
            entry.status === 'approved' ? 'bg-emerald-500' :
            entry.status === 'rejected' ? 'bg-red-500' :
            entry.status === 'in_progress' ? 'bg-blue-500' :
            entry.status === 'frozen'   ? 'bg-sky-500' :
            entry.status === 'to_be_paid' ? 'bg-orange-500' :
            entry.status === 'paid'     ? 'bg-emerald-500' :
            'bg-amber-500'
          }`} />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              entry.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
              entry.status === 'rejected' ? 'bg-red-50 text-red-700' :
              entry.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
              entry.status === 'frozen'   ? 'bg-sky-50 text-sky-700' :
              entry.status === 'to_be_paid' ? 'bg-orange-50 text-orange-700' :
              entry.status === 'paid'     ? 'bg-emerald-50 text-emerald-700' :
              'bg-amber-50 text-amber-700'
            }`}>
              {statusLabel(entry.status)}
            </span>
            <span className="text-xs text-gray-400">
              {entry.actorRole === 'employee'
                ? employeeLabel
                : showActorId && entry.actorId
                  ? `${reviewerLabel} (${entry.actorId})`
                  : reviewerLabel}
            </span>
            <span className="text-xs text-gray-400">&middot; {formatDate(entry.timestamp)}</span>
          </div>
          {entry.note && <p className="mt-1 text-xs text-gray-600">{entry.note}</p>}
        </li>
      ))}
    </ol>
  );
}
