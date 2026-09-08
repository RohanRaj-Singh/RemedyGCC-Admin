'use client';

import { CheckCircle2, Receipt, X } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/format';

interface SelectionToolbarProps {
  /** Number of currently selected rows. */
  count: number;
  /** Sum of the selected rows' billable amount. */
  totalAmount: number;
  /** Primary action — typically "Generate invoice" from a shortlist. */
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onClear: () => void;
  /** Optional secondary action (e.g. "Select all eligible"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Optional context line shown to the right of the count. */
  contextHint?: string;
  /** Optional explanation shown beneath the primary action when disabled. */
  disabledReason?: string;
}

/**
 * Sticky selection toolbar shown when one or more rows are selected on a
 * financial workspace (claims, payouts, etc). Consolidates the count, the
 * running total, and a single primary action — so the operator never has to
 * hunt for "what do I do with this shortlist?".
 *
 * Visual rule: dark surface (bg-gray-900), single primary button, clear action.
 * No decorative icons other than the receipt mark for the primary action.
 */
export default function SelectionToolbar({
  count,
  totalAmount,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  onClear,
  secondaryLabel,
  onSecondary,
  contextHint,
  disabledReason,
}: SelectionToolbarProps) {
  if (count <= 0) return null;

  return (
    <div
      className="sticky top-0 z-30 -mx-6 mb-4 border-b border-gray-800 bg-gray-900 px-6 py-3 text-white shadow-lg lg:-mx-8 lg:px-8"
      role="region"
      aria-label="Selection toolbar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold tabular-nums">{count} selected</span>
            <span className="text-gray-400">·</span>
            <span className="font-semibold tabular-nums text-emerald-300">
              {formatCurrency(totalAmount)}
            </span>
            {contextHint && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-300">{contextHint}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-gray-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Receipt className="h-4 w-4" />
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear selection"
            className="ml-1 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {disabledReason && primaryDisabled && (
        <p className="mt-2 text-xs text-amber-300">{disabledReason}</p>
      )}
    </div>
  );
}
