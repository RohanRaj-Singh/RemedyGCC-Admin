'use client';

// ── Financial status badge ──────────────────────────────────────────────────
// Single shared status pill for the financial workspaces. Renders a tone dot
// plus a text label, so meaning is never conveyed by color alone (WCAG 1.4.1).
// The tone vocabulary comes from `@/lib/financial/status` — success/warning/
// danger stay semantic; there is no decorative purple.

import type { StatusTone } from '@/lib/financial/status';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-gray-400',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

interface FinancialStatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

export default function FinancialStatusBadge({ label, tone = 'neutral' }: FinancialStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}
