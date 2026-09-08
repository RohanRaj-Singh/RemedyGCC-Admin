'use client';

// ── Activity Timeline — date-grouped recent activity (PA4 polish) ──────────
// Groups the recent activity items by date bucket (Today / Yesterday /
// This week / Earlier) and renders each bucket as its own compact list.
//
// PA4 polish:
//  - The row is a 4-column grid (icon, primary, amount, time). The verb
//    leads, the amount is right-aligned with a fixed minimum width so
//    the chevron does not jump, and the time is muted gray to recede.
//  - The date bucket label is a small uppercase eyebrow above the
//    list. Lower visual weight than the section title so the bucket
//    structure is signposted without competing with the section.
//  - Reference numbers (invoice number, claim number) use a subtle
//    monospace treatment so they scan distinctly from names.
//  - The empty state is explanatory, not generic.

import Link from 'next/link';
import { Receipt, Banknote, Wallet, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/format';
import { relativeTime } from '@/lib/dashboard/relativeTime';
import { bucketByDate } from '@/lib/dashboard/grouping';
import type { DashboardSummary, RecentActivityItem } from '@/lib/dashboard/types';

const VERB: Record<RecentActivityItem['kind'], string> = {
  invoice_issued: 'Invoice issued',
  invoice_paid: 'Invoice paid',
  payment_recorded: 'Payment recorded',
  claim_ready: 'Claim ready',
};

function hrefFor(item: RecentActivityItem): string {
  switch (item.kind) {
    case 'invoice_issued':
    case 'invoice_paid':
      return `/invoices/${item.id}`;
    case 'payment_recorded':
      return `/payments/${item.claimId}`;
    case 'claim_ready':
      return `/reimbursements/${item.id}`;
  }
}

function counterpartyFor(item: RecentActivityItem): string {
  switch (item.kind) {
    case 'invoice_issued':
    case 'invoice_paid':
      return item.tenantName;
    case 'payment_recorded':
      return item.clinicName;
    case 'claim_ready':
      return item.employeeName;
  }
}

function referenceFor(item: RecentActivityItem): string {
  switch (item.kind) {
    case 'invoice_issued':
    case 'invoice_paid':
      return item.number;
    case 'payment_recorded':
      return item.id;
    case 'claim_ready':
      return item.claimNumber;
  }
}

function iconFor(item: RecentActivityItem) {
  if (item.kind === 'invoice_issued' || item.kind === 'invoice_paid') return Receipt;
  if (item.kind === 'payment_recorded') return Banknote;
  return Wallet;
}

interface ActivityTimelineProps {
  summary: DashboardSummary;
}

export default function ActivityTimeline({ summary }: ActivityTimelineProps) {
  const groups = bucketByDate(summary.recent);

  if (groups.length === 0) {
    return (
      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <h2 id="activity-heading" className="text-sm font-semibold text-gray-900">
          Recent activity
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
          No recent activity in the last week.
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
      <h2 id="activity-heading" className="text-sm font-semibold text-gray-900">
        Recent activity
      </h2>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.bucket} className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
              {group.label}
            </p>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {group.items.map((item) => {
                const Icon = iconFor(item);
                return (
                  <li key={`${item.kind}:${item.id}`}>
                    <Link
                      href={hrefFor(item)}
                      className="group grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-gray-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-gray-900">
                          <span className="font-medium">{VERB[item.kind]}</span>
                          <span className="mx-1.5 text-gray-300">·</span>
                          <span className="font-mono text-xs text-gray-700">{referenceFor(item)}</span>
                        </p>
                        <p className="truncate text-xs text-gray-500">{counterpartyFor(item)}</p>
                      </div>
                      <span className="hidden w-24 text-right text-sm tabular-nums text-gray-700 sm:inline">
                        {formatCurrency(item.amount)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="hidden w-20 text-right text-xs tabular-nums text-gray-500 lg:inline">
                          {relativeTime(item.at)}
                        </span>
                        <ArrowRight
                          className="h-4 w-4 text-gray-300 transition-colors duration-150 group-hover:text-gray-500"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
