'use client';

import { ReactNode } from 'react';

interface FinancialEmptyStateProps {
  icon?: ReactNode;
  title: string;
  /** WHY the state is empty (context, not a generic "no data"). */
  description: string;
  /** Optional next-step action. */
  action?: { label: string; onClick: () => void };
}

/**
 * Shared empty state for the financial surfaces. States the reason (e.g. "No
 * approved claims for this organization yet") and offers the next step rather
 * than a bare "no results".
 */
export default function FinancialEmptyState({
  icon,
  title,
  description,
  action,
}: FinancialEmptyStateProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
