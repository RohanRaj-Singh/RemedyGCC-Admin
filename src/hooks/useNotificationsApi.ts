'use client';

import { useCallback, useEffect, useState } from 'react';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';

interface UseNotificationsApiResult {
  /** Reload the full list (e.g. when the panel opens). */
  refresh: () => Promise<void>;
  /** Mark a single notification as read. Returns true on success. */
  markRead: (id: string) => Promise<boolean>;
  /** Mark every notification as read. Returns true on success. */
  markAllRead: () => Promise<boolean>;
  /** True while a list fetch is in flight. */
  loading: boolean;
  /** Last error message from any of the above operations. */
  error: string | null;
  /** Clear the last error. */
  clearError: () => void;
}

/**
 * Augments the RealtimeProvider with explicit list-fetch + error reporting.
 * Keeps the provider's notifications array in sync with the server when
 * the user opens the bell panel, and surfaces API failures so the UI can
 * show a toast/banner.
 */
export function useNotificationsApi(): UseNotificationsApiResult {
  const {
    setNotifications,
    setUnreadCount,
    markRead: ctxMarkRead,
    markAllRead: ctxMarkAllRead,
  } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/notifications?limit=50', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      const items = (data.notifications ?? []) as NotificationItem[];
      const unread = (data.unreadCount ?? items.filter((i) => !i.read).length) as number;
      setNotifications(items);
      setUnreadCount(unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [setNotifications, setUnreadCount]);

  const markRead = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/super-admin/notifications/${encodeURIComponent(id)}/read`,
          { method: 'POST', credentials: 'include' },
        );
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        await ctxMarkRead(id);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to mark as read');
        return false;
      }
    },
    [ctxMarkRead],
  );

  const markAllRead = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/super-admin/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      await ctxMarkAllRead();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark all as read');
      return false;
    }
  }, [ctxMarkAllRead]);

  // Re-read unread count once on mount in case realtime hasn't fired yet.
  useEffect(() => {
    void fetch('/api/super-admin/notifications/unread-count', {
      credentials: 'include',
    })
      .then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          if (typeof data.count === 'number') setUnreadCount(data.count);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { refresh, markRead, markAllRead, loading, error, clearError };
}
