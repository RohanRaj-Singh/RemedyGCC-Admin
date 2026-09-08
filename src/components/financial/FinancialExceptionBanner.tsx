'use client';

// ── Financial exception banner ──────────────────────────────────────────────
// Used to surface non-fatal, blocking exceptions in the financial workflow
// (e.g. "1 claim selected but bank details missing", "Draft invoice has 0 line
// items"). Distinct from FinancialNextAction in two ways:
//   - Exception banners show a list of exceptions, not a single CTA
//   - Exception banners stay visible until the underlying issues are resolved
//
// The component is intentionally narrow: it does not own the exception data
// structure; the parent passes a list of strings.

import { AlertTriangle, X } from 'lucide-react';

interface FinancialExceptionBannerProps {
  title: string;
  exceptions: string[];
  /** Optional compact mode (single-line, no list). */
  compact?: boolean;
  /** Optional dismiss handler. */
  onDismiss?: () => void;
}

export default function FinancialExceptionBanner({
  title, exceptions, compact = false, onDismiss,
}: FinancialExceptionBannerProps) {
  if (exceptions.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 flex-1">
          <span className="font-semibold">{title}:</span> {exceptions.join(' · ')}
        </p>
        {onDismiss && (
          <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">{title}</p>
          <ul className="mt-2 space-y-1">
            {exceptions.map((exc, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span>{exc}</span>
              </li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}