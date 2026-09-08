'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  /** The consequences of the action, stated plainly. */
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger' | 'success' | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Context-before-confirmation for irreversible financial actions (issue, mark
 * paid, archive). States what will happen and why, so the operator confirms
 * with full understanding rather than firing a one-shot mutation.
 */
export default function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : tone === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : tone === 'warning'
          ? 'bg-amber-600 hover:bg-amber-700'
          : 'bg-blue-600 hover:bg-blue-700';

  const iconColor =
    tone === 'danger' ? 'text-red-500' : tone === 'warning' ? 'text-amber-500' : 'text-blue-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <AlertTriangle className={`h-5 w-5 ${iconColor}`} />
            </span>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-gray-600">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmClass}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
