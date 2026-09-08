'use client';

// ── Concentration Breakdown — "where is the work concentrated?" ────────────
// Renders the top 3 organizations by amount of money in flight
// (issued invoices + to_be_paid claims). Renders an explanatory empty
// state when no work is in flight.
//
// The rows come pre-computed from the server (see `topOrgsByWork` in
// `lib/dashboard/grouping.ts`) so the dashboard does not re-derive them.
// Each row links to the org-scoped payouts workspace.
//
// PA4 polish:
//  - The bar is split into two segments: blue for "awaiting payment"
//    (issued invoices) and gray for "ready to pay" (to_be_paid). The
//    operator can see at a glance whether the work is mostly upstream
//    (invoices to be paid) or downstream (payouts to be recorded).
//  - Tones are softer (gray-200/blue-200) to avoid competing with the
//    attention queue's warning/info icons.
//  - Row rhythm: 1px-tall separators are replaced by an actual card
//    structure with consistent vertical padding.

import Link from 'next/link';
import { formatCurrency } from '@/lib/financial/format';
import type { DashboardSummary } from '@/lib/dashboard/types';

interface ConcentrationBreakdownProps {
  summary: DashboardSummary;
}

function maxTotal(rows: DashboardSummary['concentration']): number {
  let m = 0;
  for (const r of rows) if (r.totalAmount > m) m = r.totalAmount;
  return m;
}

export default function ConcentrationBreakdown({ summary }: ConcentrationBreakdownProps) {
  const rows = summary.concentration;
  if (rows.length === 0) {
    return (
      <section
        aria-labelledby="concentration-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="concentration-heading" className="text-sm font-semibold text-gray-900">
          Where the work is
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          No payouts or invoices currently in flight.
        </div>
      </section>
    );
  }

  const max = maxTotal(rows);
  // Anchor bar widths so even a single tiny row renders as a visible bar.
  const denom = max > 0 ? max : 1;

  return (
    <section aria-labelledby="concentration-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="concentration-heading" className="text-sm font-semibold text-gray-900">
          Where the work is
        </h2>
        <Link
          href="/reimbursements"
          className="text-xs font-medium text-gray-500 transition-colors duration-150 hover:text-gray-900"
        >
          All claims →
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const issuedPct = Math.round((row.issuedAmount / denom) * 100);
          const payoutPct = Math.round((row.payoutAmount / denom) * 100);
          return (
            <li key={row.tenantId}>
              <Link
                href={`/payments?tenantId=${encodeURIComponent(row.tenantId)}`}
                className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3.5 transition-all duration-150 hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-gray-900">{row.tenantName}</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-900">
                    {formatCurrency(row.totalAmount)}
                  </span>
                </div>
                <div
                  className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                  role="presentation"
                >
                  <div
                    className="h-full bg-blue-400 transition-all duration-300"
                    style={{ width: `${issuedPct}%` }}
                    aria-hidden="true"
                  />
                  <div
                    className="h-full bg-gray-500 transition-all duration-300"
                    style={{ width: `${payoutPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" aria-hidden="true" />
                    Awaiting payment
                    <span className="tabular-nums text-gray-700">{formatCurrency(row.issuedAmount)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-500" aria-hidden="true" />
                    Ready to pay
                    <span className="tabular-nums text-gray-700">{formatCurrency(row.payoutAmount)}</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
