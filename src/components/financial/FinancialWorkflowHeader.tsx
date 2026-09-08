'use client';

// ── Financial workflow header ───────────────────────────────────────────────
// Page-level header used across the Super Admin's financial pages. Renders
// the page title, the subtitle, and the right-aligned page actions (e.g.
// refresh, history toggle, primary CTA). Used in place of the ad-hoc header
// blocks that lived in each page's previous implementation.

import { ReactNode } from 'react';

interface FinancialWorkflowHeaderProps {
  /** Page icon — Lucide component. */
  icon: ReactNode;
  /** Tone classes for the icon container. */
  iconContainerClass?: string;
  /** Page title (e.g. "Claims", "Payment Operations"). */
  title: string;
  /** Subtitle / supporting copy. */
  subtitle: string;
  /** Right-aligned actions. */
  actions?: ReactNode;
}

export default function FinancialWorkflowHeader({
  icon, iconContainerClass = 'bg-primary/10', title, subtitle, actions,
}: FinancialWorkflowHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconContainerClass}`}>
              {icon}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}