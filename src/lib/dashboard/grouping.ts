/**
 * Pure grouping helpers used by the redesigned Super Admin dashboard.
 *
 * Two functions live here:
 *  - `bucketByDate` — group recent activity items into Today / Yesterday /
 *    This week / Earlier. Used by `ActivityTimeline`.
 *  - `topOrgsByWork` — rank organizations by amount-of-work-in-flight
 *    (issued invoices + to_be_paid claims) and return the top N.
 *    Used by `ConcentrationBreakdown`.
 *
 * Both helpers are pure (no IO, no fetch) so they can be unit-tested in
 * isolation and called on the client at render time. They depend only on
 * the existing `DashboardSummary` types — no new backend data.
 */

import type { DashboardSummary, RecentActivityItem } from './types';

export type DateBucket = 'today' | 'yesterday' | 'thisWeek' | 'earlier';

export const DATE_BUCKET_LABEL: Record<DateBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  earlier: 'Earlier',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function bucketFor(iso: string, now: number = Date.now()): DateBucket {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'earlier';
  const todayStart = startOfDay(new Date(now)).getTime();
  const yesterdayStart = todayStart - DAY_MS;
  const weekStart = todayStart - 6 * DAY_MS;
  if (ts >= todayStart) return 'today';
  if (ts >= yesterdayStart) return 'yesterday';
  if (ts >= weekStart) return 'thisWeek';
  return 'earlier';
}

export const BUCKET_ORDER: ReadonlyArray<DateBucket> = [
  'today',
  'yesterday',
  'thisWeek',
  'earlier',
];

export interface DateBucketGroup {
  bucket: DateBucket;
  label: string;
  items: RecentActivityItem[];
}

export function bucketByDate(
  items: ReadonlyArray<RecentActivityItem>,
  now: number = Date.now(),
): DateBucketGroup[] {
  const groups: Record<DateBucket, RecentActivityItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };
  for (const item of items) {
    groups[bucketFor(item.at, now)].push(item);
  }
  return BUCKET_ORDER
    .filter((b) => groups[b].length > 0)
    .map((b) => ({ bucket: b, label: DATE_BUCKET_LABEL[b], items: groups[b] }));
}

export interface OrgWorkRow {
  tenantId: string;
  tenantName: string;
  issuedAmount: number;
  payoutAmount: number;
  totalAmount: number;
}

interface InFlightRef {
  tenantId?: string | null;
  tenantName?: string | null;
  amount: number;
}

/**
 * Rank organizations by the amount of money currently in flight
 * (issued invoices + to_be_paid claims). Returns the top N rows, sorted
 * desc by total. Ties broken alphabetically by org name.
 *
 * The inputs are the internal upstream payloads that the summary route
 * already has. We don't fetch any new data here.
 */
export function topOrgsByWork(
  toBePaid: ReadonlyArray<InFlightRef>,
  issued: ReadonlyArray<{ tenantId?: string | null; tenantName?: string | null; totalAmount: number }>,
  limit: number = 3,
): OrgWorkRow[] {
  const map = new Map<string, OrgWorkRow>();

  function ensure(tenantId: string, tenantName: string): OrgWorkRow {
    const existing = map.get(tenantId);
    if (existing) return existing;
    const row: OrgWorkRow = {
      tenantId,
      tenantName: tenantName || tenantId,
      issuedAmount: 0,
      payoutAmount: 0,
      totalAmount: 0,
    };
    map.set(tenantId, row);
    return row;
  }

  for (const inv of issued) {
    if (!inv.tenantId) continue;
    const row = ensure(inv.tenantId, inv.tenantName ?? '');
    row.issuedAmount += Number(inv.totalAmount ?? 0);
  }
  for (const c of toBePaid) {
    if (!c.tenantId) continue;
    const row = ensure(c.tenantId, c.tenantName ?? '');
    row.payoutAmount += Number(c.amount ?? 0);
  }

  const rows = Array.from(map.values()).map((r) => ({
    ...r,
    totalAmount: r.issuedAmount + r.payoutAmount,
  }));

  rows.sort((a, b) => {
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return a.tenantName.localeCompare(b.tenantName);
  });

  return rows.slice(0, limit);
}

/**
 * A short, useful headline for the dashboard. Picks the single most
 * important state to surface. Mirrors the priority ladder the
 * AttentionQueue uses, but in one line for the page header.
 */
export function headlineFor(s: DashboardSummary): string {
  const w = s.workflow;
  const parts: string[] = [];
  if (w.blocked.count > 0) {
    parts.push(`${w.blocked.count} blocked payout${w.blocked.count === 1 ? '' : 's'}`);
  }
  if (w.awaitingOrgPayment.count > 0) {
    parts.push(
      `${w.awaitingOrgPayment.count} invoice${w.awaitingOrgPayment.count === 1 ? '' : 's'} awaiting payment`,
    );
  }
  if (w.readyForBilling.count > 0) {
    parts.push(
      `${w.readyForBilling.count} claim${w.readyForBilling.count === 1 ? '' : 's'} ready to bill`,
    );
  }
  if (s.context.notificationsUnread > 0) {
    parts.push(
      `${s.context.notificationsUnread} unread notification${s.context.notificationsUnread === 1 ? '' : 's'}`,
    );
  }
  if (parts.length === 0) return 'All financial operations are up to date.';
  return parts.join(' · ');
}
