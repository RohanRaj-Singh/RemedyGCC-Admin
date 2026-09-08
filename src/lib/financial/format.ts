/**
 * Financial formatting helpers — shared currency and date formatting for the
 * Super Admin financial surfaces. Kept here (not duplicated in page files) so
 * Claims, Invoices, and the detail pages format identically.
 */

export function formatCurrency(amount: number): string {
  // Two decimals with thousands separators ("OMR 12,450.00") so figures scan
  // as money at a glance. `toLocaleString` also avoids the float-noise of
  // `toFixed` (e.g. 0.1 + 0.2 renders "0.30", not "0.30000000000000004").
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `OMR ${formatted}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
