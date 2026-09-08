'use client';

import { AlertCircle, Archive, CheckCircle2, FileEdit, Send } from 'lucide-react';
  import Link from 'next/link';

  export type InvoiceCalloutStatus = 'draft' | 'issued' | 'paid' | 'archived';

  interface InvoiceStatusCalloutProps {
    status: InvoiceCalloutStatus;
    /** Optional override for the headline (e.g. "Awaiting organization payment"). */
    title?: string;
    /** Optional override for the body copy. Defaults per status. */
    description?: string;
    /** Optional override for the CTA. */
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    /** Optional secondary action rendered beside the primary CTA. */
    secondaryAction?: { label: string; href: string };
    /** Optional count of associated claims — surfaced in the body. */
    claimCount?: number;
  }

/**
 * Readable status banner for the top of the invoice detail page.
 *
 * Status copy uses operational language (Draft / Awaiting organization
 * payment / Paid / Archived) so the operator understands the invoice's
 * real-world state without having to translate a status enum.
 *
 * - draft    → editable; can be issued to the organization
 * - issued   → invoice is owed; organization must pay Remedy GCC
 * - paid     → organization has paid; claims are now ready for payout
 * - archived → historical; no further actions
 */
export default function InvoiceStatusCallout({
  status,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryAction,
  claimCount,
}: InvoiceStatusCalloutProps) {
  const config = getStatusConfig(status);

  const headline = title ?? config.title;
  const body = description ?? config.description;
  const ctaLabel = actionLabel ?? config.defaultActionLabel;
  const ctaHref = actionHref ?? config.defaultActionHref;
  const Icon = config.icon;

  const tones = config.tone;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:gap-4 ${tones.shell}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tones.iconBg}`}>
        <Icon className={`h-5 w-5 ${tones.iconFg}`} />
      </span>
      <div className="flex-1">
        <h3 className={`text-sm font-semibold ${tones.titleFg}`}>{headline}</h3>
        <p className={`mt-1 text-sm ${tones.bodyFg}`}>
          {body}
          {typeof claimCount === 'number' && (
            <>
              {' '}
              <span className="font-medium">{claimCount}</span>{' '}
              {claimCount === 1 ? 'claim' : 'claims'} on this invoice.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              status === 'issued'
                ? 'border-blue-300 text-blue-800 hover:bg-blue-100'
                : status === 'paid'
                  ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : status === 'draft'
                    ? 'border-amber-300 text-amber-800 hover:bg-amber-100'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {secondaryAction.label}
          </Link>
        )}
        {(ctaLabel && (onAction || ctaHref)) && (
          <div className="shrink-0">
            {onAction ? (
              <button
                type="button"
                onClick={onAction}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tones.cta}`}
              >
                {ctaLabel}
              </button>
            ) : (
              <Link
                href={ctaHref!}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tones.cta}`}
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusConfig(status: InvoiceCalloutStatus): {
  title: string;
  description: string;
  defaultActionLabel?: string;
  defaultActionHref?: string;
  icon: typeof FileEdit;
  tone: {
    shell: string;
    iconBg: string;
    iconFg: string;
    titleFg: string;
    bodyFg: string;
    cta: string;
  };
} {
  switch (status) {
    case 'draft':
      return {
        title: 'Draft',
        description:
          'This invoice has not been sent to the organization yet. Issue it to make it payable.',
        defaultActionLabel: 'Issue invoice',
        icon: FileEdit,
        tone: {
          shell: 'border-amber-200 bg-amber-50',
          iconBg: 'bg-amber-100',
          iconFg: 'text-amber-700',
          titleFg: 'text-amber-900',
          bodyFg: 'text-amber-900/80',
          cta: 'bg-amber-600 text-white hover:bg-amber-700',
        },
      };
    case 'issued':
      return {
        title: 'Awaiting organization payment',
        description:
          'The organization owes Remedy GCC for the claims on this invoice. Record payment once it arrives.',
        defaultActionLabel: 'View payments',
        defaultActionHref: '/payments',
        icon: Send,
        tone: {
          shell: 'border-blue-200 bg-blue-50',
          iconBg: 'bg-blue-100',
          iconFg: 'text-blue-700',
          titleFg: 'text-blue-900',
          bodyFg: 'text-blue-900/80',
          cta: 'bg-blue-600 text-white hover:bg-blue-700',
        },
      };
    case 'paid':
      return {
        title: 'Paid',
        description:
          'The organization has paid Remedy GCC. The associated claims are now ready for payout.',
        defaultActionLabel: 'Go to Payments',
        defaultActionHref: '/payments',
        icon: CheckCircle2,
        tone: {
          shell: 'border-emerald-200 bg-emerald-50',
          iconBg: 'bg-emerald-100',
          iconFg: 'text-emerald-700',
          titleFg: 'text-emerald-900',
          bodyFg: 'text-emerald-900/80',
          cta: 'bg-emerald-600 text-white hover:bg-emerald-700',
        },
      };
    case 'archived':
      return {
        title: 'Archived',
        description:
          'This invoice is archived for record-keeping and cannot be modified or re-issued.',
        icon: Archive,
        tone: {
          shell: 'border-gray-200 bg-gray-50',
          iconBg: 'bg-gray-100',
          iconFg: 'text-gray-600',
          titleFg: 'text-gray-900',
          bodyFg: 'text-gray-700',
          cta: 'bg-gray-600 text-white hover:bg-gray-700',
        },
      };
  }
}