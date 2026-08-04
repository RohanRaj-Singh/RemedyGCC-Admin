'use client';

// ── Success banner (transient action feedback) ─────────────────────────────
// Shared feedback for financial actions across Claims / Invoices / Payments.
// Every action answers: *What just happened · What next.* The message states
// the outcome; the optional action carries the next step (navigation link).
//
// Per the approved workflow guidance contract:
//   Toast  = what happened + what's next  (this banner)
//   Banner = persistent state (e.g. "Ready for billing")
//   Stepper = orientation (WorkflowStepper)

import { CheckCircle2 } from 'lucide-react';

interface SuccessBannerAction {
  href: string;
  label: string;
}

interface SuccessBannerProps {
  message: string;
  action?: SuccessBannerAction | null;
}

export default function SuccessBanner({ message, action }: SuccessBannerProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
        <p className="text-sm text-green-700 flex-1">{message}</p>
      </div>
      {action && (
        <a
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
