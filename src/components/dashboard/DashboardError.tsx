'use client';

// ── Dashboard error — full-page error state with a retry ───────────────────
// Used when the summary endpoint fails entirely. Per-section errors are
// surfaced inside each section (skeleton + retry button) — this is the
// last-resort state when the page can't render at all.

import { AlertTriangle } from 'lucide-react';

interface DashboardErrorProps {
  message: string;
  onRetry: () => void;
}

export default function DashboardError({ message, onRetry }: DashboardErrorProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-700" aria-hidden="true" />
        <p className="text-sm font-semibold text-red-900">{`Couldn't load the dashboard.`}</p>
      </div>
      <p className="text-sm text-red-800/90">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
      >
        Retry
      </button>
    </div>
  );
}