'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import type { DeleteTenantConsequences, TenantStatus } from '../types';

interface DeleteTenantDialogProps {
  isOpen: boolean;
  tenantName: string;
  consequences: DeleteTenantConsequences;
  onClose: () => void;
  onConfirm: (slug: string, acknowledgeDataLoss: boolean) => Promise<void>;
}

const STATUS_LABELS: Record<TenantStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft Setup', color: '#92400e', bg: 'rgba(245, 158, 11, 0.12)' },
  active: { label: 'Live Survey', color: '#166534', bg: 'rgba(34, 197, 94, 0.12)' },
  disabled: { label: 'Disabled', color: '#475569', bg: 'rgba(148, 163, 184, 0.18)' },
  archived: { label: 'Archived', color: '#3f3f46', bg: 'rgba(82, 82, 91, 0.16)' },
};

export function DeleteTenantDialog({
  isOpen,
  tenantName,
  consequences,
  onClose,
  onConfirm,
}: DeleteTenantDialogProps) {
  const [slugInput, setSlugInput] = useState('');
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const {
    slug,
    status,
    submissionCount,
    runtimeConfigCount,
    hasActiveSurvey,
    hasBrandingAssets,
  } = consequences;

  const hasConsequences = submissionCount > 0 || runtimeConfigCount > 0 || hasActiveSurvey || hasBrandingAssets;
  const slugConfirmed = slugInput.trim() === slug;
  const canDelete = slugConfirmed && (!hasConsequences || acknowledgeDataLoss);

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(slug, acknowledgeDataLoss);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tenant.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setSlugInput('');
      setAcknowledgeDataLoss(false);
      setError(null);
      onClose();
    }
  };

  const statusMeta = STATUS_LABELS[status] ?? { label: 'Unknown', color: '#475569', bg: 'rgba(148, 163, 184, 0.18)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
          <div className="rounded-full bg-red-100 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900">Delete Tenant: {tenantName}?</h3>
            <p className="text-sm text-red-700">This action cannot be undone.</p>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="rounded-full p-1.5 text-red-500 hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <span
              className="inline-flex rounded-lg px-3 py-1 text-sm font-semibold"
              style={{ backgroundColor: statusMeta.bg, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
          </div>

          {/* Consequences */}
          {hasConsequences && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-red-800">
                The following data will be permanently deleted:
              </p>
              <ul className="space-y-1.5 text-sm text-red-700">
                {hasActiveSurvey && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    Active live survey will be taken down
                  </li>
                )}
                {submissionCount > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <strong>{submissionCount}</strong> submission{submissionCount === 1 ? '' : 's'} will be
                    permanently deleted
                  </li>
                )}
                {runtimeConfigCount > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    <strong>{runtimeConfigCount}</strong> published surve{runtimeConfigCount === 1 ? 'y' : 'ys'}{' '}
                    will be deleted
                  </li>
                )}
                {hasBrandingAssets && (
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                    Branding assets (logo, background) will be removed
                  </li>
                )}
              </ul>
              <p className="text-xs text-red-600 mt-1">
                Tenant dashboard access users will also be removed.
              </p>
            </div>
          )}

          {/* No consequences */}
          {!hasConsequences && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                This tenant is in <strong>Draft Setup</strong> with no submissions or published surveys.
              </p>
            </div>
          )}

          {/* Slug confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800">{slug}</code> to confirm
            </label>
            <input
              type="text"
              value={slugInput}
              onChange={(event) => setSlugInput(event.target.value)}
              placeholder={slug}
              disabled={isDeleting}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm disabled:opacity-50"
            />
          </div>

          {/* Data loss acknowledgement checkbox */}
          {hasConsequences && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgeDataLoss}
                onChange={(event) => setAcknowledgeDataLoss(event.target.checked)}
                disabled={isDeleting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                I understand this will permanently delete all data for this tenant.
              </span>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
