/**
 * Tiny relative-time formatter for the dashboard recent activity feed.
 * Deliberately dependency-free — `Intl.RelativeTimeFormat` is in every
 * browser since 2018 and Next.js compiles away any modern Node targets
 * that lack it. No new package added.
 *
 * Buckets:
 *   < 60s          → "just now"
 *   < 60m          → "12 min ago"
 *   < 24h (today)  → "today, 14:32"
 *   < 48h          → "yesterday, 09:11"
 *   < 7d           → "Mon, 14:32"
 *   else           → "Aug 27, 2026"
 *
 * Always in the viewer's local timezone (the dashboard renders server-side
 * shells, but the timestamp strings are produced on the client). The
 * numbers come from `formatCurrency`/`formatDate` already produced on
 * the client side, so this is consistent.
 */
const RTF =
  typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat !== 'undefined'
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '—';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '—';

  const diff = ts - now;
  const abs = Math.abs(diff);

  // "just now" — within 30s either way.
  if (abs < 30_000) return 'just now';

  // Minutes / hours use Intl.RelativeTimeFormat when available so the copy
  // matches what every other tool in the world renders.
  if (abs < HOUR) {
    const m = Math.round(diff / MIN);
    return RTF ? RTF.format(m, 'minute') : `${Math.abs(m)} min ago`;
  }
  if (abs < DAY) {
    const h = Math.round(diff / HOUR);
    return RTF ? RTF.format(h, 'hour') : `${Math.abs(h)} h ago`;
  }

  // Beyond a day, drop the relative phrasing and switch to calendar form.
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  const yesterday = new Date(now - DAY).toDateString() === d.toDateString();
  const withinWeek = abs < 7 * DAY;

  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (sameDay) return `today, ${timePart}`;
  if (yesterday) return `yesterday, ${timePart}`;
  if (withinWeek) {
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${day}, ${timePart}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}