/**
 * Compact "12 min ago" formatter for financial surfaces.
 * No external deps; output is stable (no "yesterday", no locale strings).
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Returns a short human label for the time elapsed since `iso`.
 *
 * - < 1 min  → "just now"
 * - < 1 hour → "12m ago"
 * - < 1 day  → "5h ago"
 * - < 7 days → "3d ago"
 * - otherwise → ISO date (YYYY-MM-DD)
 *
 * Falls back to the ISO date if the input cannot be parsed.
 */
export function relativeTimeShort(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';

  const delta = now.getTime() - t;
  if (delta < 0) return 'just now';
  if (delta < MIN) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MIN)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  // Beyond a week, show the absolute date so the operator gets a precise anchor.
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Returns a coarse "age" tone for use as a semantic background/text class.
 * Used by tables that want to flag stale rows without inventing an SLA.
 *
 * - < 1 day  → neutral
 * - 1–7 days → info
 * - 7–14 days → warning
 * - >= 14 days → danger
 *
 * The tone is purely informational. It MUST NOT be used to gate actions or
 * imply a contract.
 */
export type RelativeAgeTone = 'neutral' | 'info' | 'warning' | 'danger';

export function relativeAgeTone(iso: string | null | undefined, now: Date = new Date()): RelativeAgeTone {
  if (!iso) return 'neutral';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'neutral';
  const delta = now.getTime() - t;
  if (delta < DAY) return 'neutral';
  if (delta < 7 * DAY) return 'info';
  if (delta < 14 * DAY) return 'warning';
  return 'danger';
}