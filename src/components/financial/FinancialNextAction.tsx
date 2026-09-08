'use client';

// ── Financial next-action banner ─────────────────────────────────────────────
// Single recommended-action banner used across the Super Admin's financial
// pages. Surfaces exactly one primary CTA and one optional secondary action,
// so the user always knows what to do next.
//
// Phase B (2026-08-20): this replaces the ad-hoc green/amber/red banners that
// lived in reimbursements/page.tsx, invoices/page.tsx, and payments/page.tsx
// with one consistent component.

import { ArrowRight, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<Tone, { container: string; icon: string; iconColor: string }> = {
  info: {
    container: 'border-blue-200 bg-blue-50',
    icon: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
  },
  warning: {
    container: 'border-amber-200 bg-amber-50',
    icon: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
  danger: {
    container: 'border-red-200 bg-red-50',
    icon: 'bg-red-100',
    iconColor: 'text-red-600',
  },
};

function ToneIcon({ tone }: { tone: Tone }) {
  if (tone === 'warning') return <AlertTriangle className={`h-5 w-5 ${TONE_CLASSES[tone].iconColor}`} />;
  if (tone === 'danger') return <AlertTriangle className={`h-5 w-5 ${TONE_CLASSES[tone].iconColor}`} />;
  if (tone === 'success') return <CheckCircle2 className={`h-5 w-5 ${TONE_CLASSES[tone].iconColor}`} />;
  return <Info className={`h-5 w-5 ${TONE_CLASSES[tone].iconColor}`} />;
}

interface FinancialNextActionProps {
  /** Short title shown in bold. */
  title: string;
  /** Optional supporting copy (1-2 sentences). */
  description?: string;
  tone?: Tone;
  /** Primary CTA (anchor). Mutually exclusive with `onAction`. */
  action?: { href: string; label: string };
  /** Primary CTA as an in-place button (e.g. opening a dialog). */
  onAction?: { label: string; onClick: () => void };
  /** Optional secondary action. */
  secondaryAction?: { href: string; label: string };
}

export default function FinancialNextAction({
  title, description, tone = 'info', action, onAction, secondaryAction,
}: FinancialNextActionProps) {
  const toneClass = TONE_CLASSES[tone];

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 ${toneClass.container}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass.icon}`}>
        <ToneIcon tone={tone} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${tone === 'warning' ? 'text-amber-900' : tone === 'danger' ? 'text-red-900' : tone === 'success' ? 'text-emerald-900' : 'text-blue-900'}`}>
          {title}
        </p>
        {description && (
          <p className={`mt-1 text-xs ${tone === 'warning' ? 'text-amber-800' : tone === 'danger' ? 'text-red-800' : tone === 'success' ? 'text-emerald-800' : 'text-blue-800'}`}>
            {description}
          </p>
        )}
      </div>
      {(action || onAction || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {action && (
            <a
              href={action.href}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${
                tone === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                tone === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {action.label}
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
          {onAction && (
            <button
              type="button"
              onClick={onAction.onClick}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${
                tone === 'warning' ? 'bg-amber-600 hover:bg-amber-700' :
                tone === 'danger' ? 'bg-red-600 hover:bg-red-700' :
                tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {onAction.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {secondaryAction && (
            <a
              href={secondaryAction.href}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                tone === 'warning' ? 'border-amber-300 text-amber-800 hover:bg-amber-100' :
                tone === 'danger' ? 'border-red-300 text-red-800 hover:bg-red-100' :
                tone === 'success' ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-100' :
                'border-blue-300 text-blue-800 hover:bg-blue-100'
              }`}
            >
              {secondaryAction.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}