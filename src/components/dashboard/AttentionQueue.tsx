'use client';

// ── Attention Queue — the dashboard's primary "what now?" surface ──────────
// One ranked list. Each item is a real, actionable thing the operator
// can resolve. No decorative entries. No duplication with the workflow
// pipeline — the pipeline answers "what is the state?", this answers
// "what needs my action?".
//
// Priority order is the existing financial-workflow priority ladder
// (mirrors Phase-7 FinancialNextAction):
//   1. Blocked payouts           → /payments?tab=blocked
//   2. Invoices awaiting payment  → /invoices?status=issued
//   3. Ready for billing          → /reimbursements?status=approved
//   4. Unread notifications       → /notifications
//
// An "All clear" empty state replaces the entire panel when there is
// nothing to act on.
//
// PA4 polish:
//  - Tighter row rhythm: row height is consistent regardless of the meta
//    (currency or "Inbox"). The icon container is 32px, the meta has a
//    fixed minimum width so the chevron does not jump when the value
//    changes.
//  - Subtle, fast transitions (150ms) for hover.
//  - When the notifications item is the only one in the queue, the
//    "Mark all read" action is offered inline. The action is provided
//    by the parent (DashboardView) so the child does not own a second
//    copy of the dashboard hook (which would not share state with the
//    parent's hook).
//  - The "All clear" banner is intentional and positive — emerald tone
//    with a check icon, not a muted empty state.

import Link from 'next/link';
import { AlertTriangle, Clock, CheckCircle2, FileText, Bell, ArrowRight, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/format';
import type { DashboardSummary } from '@/lib/dashboard/types';

type IconKind = 'warning' | 'clock' | 'doc' | 'bell';
type Tone = 'warning' | 'info' | 'success';

interface QueueItem {
  id: string;
  icon: IconKind;
  tone: Exclude<Tone, 'success'>;
  title: string;
  meta: string;
  href: string;
}

const ICON_BG: Record<Exclude<Tone, 'success'>, string> = {
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

function ICON_FOR(kind: IconKind) {
  switch (kind) {
    case 'warning': return AlertTriangle;
    case 'clock': return Clock;
    case 'doc': return FileText;
    case 'bell': return Bell;
  }
}

function buildQueue(summary: DashboardSummary): QueueItem[] {
  const out: QueueItem[] = [];
  const w = summary.workflow;
  const notificationsUnread = summary.context.notificationsUnread;

  if (w.blocked.count > 0) {
    out.push({
      id: 'blocked',
      icon: 'warning',
      tone: 'warning',
      title: `${w.blocked.count} payout${w.blocked.count === 1 ? '' : 's'} blocked — bank details missing`,
      meta: formatCurrency(w.blocked.amount),
      href: '/payments?tab=blocked',
    });
  }
  if (w.awaitingOrgPayment.count > 0) {
    out.push({
      id: 'awaiting',
      icon: 'clock',
      tone: 'info',
      title: `${w.awaitingOrgPayment.count} invoice${w.awaitingOrgPayment.count === 1 ? '' : 's'} awaiting organization payment`,
      meta: formatCurrency(w.awaitingOrgPayment.amount),
      href: '/invoices?status=issued',
    });
  }
  if (w.readyForBilling.count > 0) {
    out.push({
      id: 'ready-billing',
      icon: 'doc',
      tone: 'info',
      title: `${w.readyForBilling.count} approved claim${w.readyForBilling.count === 1 ? '' : 's'} ready to bill`,
      meta: formatCurrency(w.readyForBilling.amount),
      href: '/reimbursements?status=approved',
    });
  }
  if (notificationsUnread > 0) {
    out.push({
      id: 'notifications',
      icon: 'bell',
      tone: 'info',
      title: `${notificationsUnread} unread notification${notificationsUnread === 1 ? '' : 's'}`,
      meta: 'Inbox',
      href: '/notifications',
    });
  }

  return out;
}

interface AttentionQueueProps {
  summary: DashboardSummary;
  /**
   * Optional callback that, when provided and the queue is just
   * notifications, renders an inline "Mark all read" action below the
   * list. The callback posts to `/api/super-admin/notifications/read-all`
   * and is expected to refresh the dashboard summary on success.
   */
  onMarkAllNotificationsRead?: () => void;
  markingNotifications?: boolean;
}

export default function AttentionQueue({
  summary,
  onMarkAllNotificationsRead,
  markingNotifications = false,
}: AttentionQueueProps) {
  const items = buildQueue(summary);

  // "Mark all read" is only offered when the queue is *just* notifications —
  // i.e. there is real financial work already represented elsewhere on the
  // page. We don't surface the action as a separate button elsewhere in
  // this phase to avoid visual competition with the action list.
  const onlyNotifications =
    items.length === 1 && items[0].id === 'notifications' && Boolean(onMarkAllNotificationsRead);

  if (items.length === 0) {
    return (
      <section
        aria-live="polite"
        className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-emerald-900">All clear — no items need your attention right now.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="attention-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="attention-heading" className="text-sm font-semibold text-gray-900">
          Needs your attention
        </h2>
        <span className="text-xs tabular-nums text-gray-500">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {items.map((item) => {
          const Icon = ICON_FOR(item.icon);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-gray-50"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ICON_BG[item.tone]}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm text-gray-900">{item.title}</p>
                <span className="hidden w-24 text-right text-sm tabular-nums text-gray-500 sm:inline">{item.meta}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors duration-150 group-hover:text-gray-500" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
      {onlyNotifications ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMarkAllNotificationsRead}
            disabled={markingNotifications}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            {markingNotifications ? 'Marking…' : 'Mark all read'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
