'use client';

import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

export type BillingInvoiceStatus = 'draft' | 'issued' | 'paid' | 'archived';

interface BillingAction {
  key: string;
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'success' | 'danger' | 'neutral';
  loading?: boolean;
  disabled?: boolean;
}

interface BillingActionBarProps {
  status: BillingInvoiceStatus;
  /** Can the operator issue this draft invoice to the organization? */
  canIssue?: boolean;
  /** Can the operator record that the organization has paid? Issued-only. */
  canMarkPaid?: boolean;
  /** Can the operator archive this invoice? Drafts cannot be archived. */
  canArchive?: boolean;
  onIssue?: () => void;
  onMarkPaid?: () => void;
  onArchive?: () => void;
  onExportCsv?: () => void;
  onDownloadPdf?: () => void;
  loadingKey?: string | null;
}

/**
 * State-dependent primary action bar for the invoice detail page.
 * Surfaces EXACTLY ONE primary action per state, plus read-only exports.
 *
 * State mapping:
 *   draft   → "Issue invoice" (primary) → makes invoice visible to org
 *   issued  → "Record organization payment" (primary) → org has paid Remedy
 *   paid    → read-only; exports only
 *   archived → read-only; exports only
 *
 * This replaces ad-hoc per-row buttons that competed with the row link and
 * made "what can I do now?" hard to answer at a glance.
 */
export default function BillingActionBar({
  status,
  canIssue = true,
  canMarkPaid = true,
  canArchive = true,
  onIssue,
  onMarkPaid,
  onArchive,
  onExportCsv,
  onDownloadPdf,
  loadingKey = null,
}: BillingActionBarProps) {
  const primary: BillingAction | null = (() => {
    if (status === 'draft' && canIssue && onIssue) {
      return { key: 'issue', label: 'Issue invoice', onClick: onIssue, tone: 'primary' };
    }
    if (status === 'issued' && canMarkPaid && onMarkPaid) {
      return { key: 'markPaid', label: 'Record organization payment', onClick: onMarkPaid, tone: 'success' };
    }
    return null;
  })();

  const secondary: BillingAction[] = [];
  if (status !== 'archived' && canArchive && onArchive && (status === 'paid' || status === 'draft')) {
    secondary.push({
      key: 'archive',
      label: 'Archive',
      onClick: onArchive,
      tone: 'neutral',
    });
  }

  const toneClass = (tone: BillingAction['tone']) => {
    switch (tone) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      default:
        return 'border border-gray-200 text-gray-700 hover:bg-gray-50 bg-white';
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {primary && (
          <button
            type="button"
            onClick={primary.onClick}
            disabled={loadingKey === primary.key}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass(primary.tone)}`}
          >
            {loadingKey === primary.key && <Loader2 className="h-4 w-4 animate-spin" />}
            {primary.label}
          </button>
        )}
        {secondary.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={loadingKey === a.key}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass(a.tone)}`}
          >
            {loadingKey === a.key && <Loader2 className="h-4 w-4 animate-spin" />}
            {a.label}
          </button>
        ))}
        {!primary && secondary.length === 0 && (
          <span className="text-sm text-gray-500">No further actions. This invoice is read-only.</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </button>
        )}
        {onDownloadPdf && (
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        )}
      </div>
    </div>
  );
}