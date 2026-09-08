'use client';

import { useEffect, useRef } from 'react';

const MAX_UNREAD_DISPLAYED = 99;
const UNREAD_PREFIX_PATTERN = /^(?:\(\d+\+?\)\s*)+/;

/** Remove an existing "(N)" / "(N+)" unread prefix from a tab title. */
export function stripUnreadPrefix(title: string): string {
  return title.replace(UNREAD_PREFIX_PATTERN, '');
}

export function withUnreadPrefix(count: number, originalTitle: string): string {
  // Always strip any existing prefix first so repeated applications are
  // idempotent — "(9) (8) Page" can never accumulate.
  const base = stripUnreadPrefix(originalTitle);
  if (!count || count <= 0) return base;
  const shown = count > MAX_UNREAD_DISPLAYED ? `${MAX_UNREAD_DISPLAYED}+` : String(count);
  return `(${shown}) ${base}`;
}

export function useTabTitle(unreadCount: number, originalTitle: string): void {
  const lastApplied = useRef<string>('');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Wait until a real base title is known — never write a bare "(N) " prefix.
    if (!originalTitle) return;
    const next = withUnreadPrefix(unreadCount, originalTitle);
    if (next !== lastApplied.current) {
      document.title = next;
      lastApplied.current = next;
    }
  }, [unreadCount, originalTitle]);
  useEffect(() => {
    return () => {
      // Restore the clean title on unmount so a later mount can never
      // mistake the prefixed title for the original.
      if (typeof document !== 'undefined' && lastApplied.current) {
        document.title = withUnreadPrefix(0, lastApplied.current);
      }
    };
  }, []);
}
