/**
 * Selection model for the Claims billing workflow.
 *
 * Two representations coexist:
 *   - `SelectionAmountMap` (Map<claimId, amount>) — the page-level "shortlist"
 *     that persists across filter / pagination changes and drives the inline
 *     toolbar count + total even when a selected claim scrolls off the current
 *     page. Clearing is an explicit user action, never an effect side-effect.
 *   - `string[]` — the Generate dialog's authoritative selection over the full
 *     org-scoped eligible set, where totals are recomputed from the claims list.
 *
 * All helpers are pure so they can be unit-tested without React.
 */

export type SelectionAmountMap = Map<string, number>;

export function toggleSelection(
  selection: SelectionAmountMap,
  id: string,
  amount: number,
): SelectionAmountMap {
  const next = new Map(selection);
  if (next.has(id)) next.delete(id);
  else next.set(id, amount);
  return next;
}

export function selectMany(
  selection: SelectionAmountMap,
  entries: Array<{ id: string; amount: number }>,
): SelectionAmountMap {
  const next = new Map(selection);
  for (const { id, amount } of entries) next.set(id, amount);
  return next;
}

export function clearSelection(): SelectionAmountMap {
  return new Map();
}

export function selectionCount(selection: SelectionAmountMap): number {
  return selection.size;
}

export function selectionTotal(selection: SelectionAmountMap): number {
  let sum = 0;
  for (const amount of selection.values()) sum += amount;
  return sum;
}

// ── Dialog selection (array-based, org-scoped) ──────────────────────────────

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function selectAllIds(eligibleIds: string[]): string[] {
  return [...eligibleIds];
}

export function clearIds(): string[] {
  return [];
}
