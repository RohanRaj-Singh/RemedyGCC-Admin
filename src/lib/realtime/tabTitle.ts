'use client';

import { useEffect, useRef } from 'react';

const MAX_UNREAD_DISPLAYED = 99;

export function withUnreadPrefix(count: number, originalTitle: string): string {
  if (!count || count <= 0) return originalTitle;
  const shown = count > MAX_UNREAD_DISPLAYED ? `${MAX_UNREAD_DISPLAYED}+` : String(count);
  return `(${shown}) ${originalTitle}`;
}

export function useTabTitle(unreadCount: number, originalTitle: string): void {
  const lastApplied = useRef<string>('');
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const next = withUnreadPrefix(unreadCount, originalTitle);
    if (next !== lastApplied.current) {
      document.title = next;
      lastApplied.current = next;
    }
  }, [unreadCount, originalTitle]);
}
