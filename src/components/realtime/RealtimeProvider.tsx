'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeStream, type RealtimeEvent } from '@/hooks/useRealtimeStream';
import { playNotificationSound, unlockAudio } from '@/lib/realtime/notificationSound';
import { sendBrowserNotification } from '@/lib/realtime/browserNotify';
import { useTabTitle } from '@/lib/realtime/tabTitle';

const SOUND_PREF_KEY = 'remedy:notify-sound';
const BROWSER_PREF_KEY = 'remedy:notify-browser';
const TOAST_TTL_MS = 4500;
const MAX_TOASTS = 3;
const MAX_NOTIFICATIONS_KEPT = 50;

export interface RealtimeNotification {
  notificationId: string;
  claimId: string;
  claimNumber?: string;
  requestId?: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface RealtimeToast {
  toastId: string;
  notificationId: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

interface RealtimeContextValue {
  connected: boolean;
  unreadCount: number;
  notifications: RealtimeNotification[];
  toasts: RealtimeToast[];
  soundEnabled: boolean;
  browserNotifyEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setBrowserNotifyEnabled: (enabled: boolean) => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (toastId: string) => void;
  /**
   * Imperative setters for callers that hydrate from a list-fetch
   * (e.g. when the bell panel opens). Realtime events still take precedence
   * via SSE — these only merge server-authoritative state.
   */
  setNotifications: (items: RealtimeNotification[]) => void;
  setUnreadCount: (count: number) => void;
  /** Shared SSE subscription — same shape as the standalone `useRealtimeStream`. */
  sse: {
    connected: boolean;
    on: (kind: string, handler: (event: import('@/hooks/useRealtimeStream').RealtimeEvent) => void) => () => void;
  };
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function buildHref(notification: RealtimeNotification): string {
  if (notification.type === 'claim_request' && notification.requestId) {
    return `/requests/${encodeURIComponent(notification.requestId)}`;
  }
  return `/reimbursements/${encodeURIComponent(notification.claimId)}`;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { connected, on } = useRealtimeStream();
  const [unreadCount, setUnreadCountState] = useState(0);
  const [notifications, setNotificationsState] = useState<RealtimeNotification[]>([]);
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState(false);
  const [browserNotifyEnabled, setBrowserNotifyEnabledState] = useState(false);
  const originalTitleRef = useRef<string>('');
  const wasConnectedRef = useRef(false);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Capture the original document title once on mount.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    originalTitleRef.current = document.title;
  }, []);

  // Load persisted prefs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setSoundEnabledState(window.localStorage.getItem(SOUND_PREF_KEY) === '1');
      setBrowserNotifyEnabledState(window.localStorage.getItem(BROWSER_PREF_KEY) === '1');
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Fetch initial unread count.
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/notifications/unread-count', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(typeof data.count === 'number' ? data.count : 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchUnread();
  }, [fetchUnread]);

  // Update tab title.
  useTabTitle(unreadCount, originalTitleRef.current || (typeof document !== 'undefined' ? document.title : ''));

  // SSE handler for new notifications.
  useEffect(() => {
    return on('notification.created', (event: RealtimeEvent) => {
      const data = event.data as RealtimeNotification | null;
      if (!data || !data.notificationId) return;

      const item: RealtimeNotification = {
        notificationId: data.notificationId,
        claimId: data.claimId ?? '',
        claimNumber: data.claimNumber,
        requestId: data.requestId,
        type: data.type ?? 'general',
        title: data.title ?? 'New notification',
        body: data.body ?? '',
        read: false,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };

      setNotificationsState((prev) => {
        const without = prev.filter((n) => n.notificationId !== item.notificationId);
        return [item, ...without].slice(0, MAX_NOTIFICATIONS_KEPT);
      });
      setUnreadCountState((prev) => prev + 1);

      const toast: RealtimeToast = {
        toastId: `toast-${item.notificationId}-${Date.now()}`,
        notificationId: item.notificationId,
        title: item.title,
        body: item.body,
        href: buildHref(item),
        createdAt: item.createdAt,
      };
      setToasts((prev) => {
        const next = [...prev, toast];
        // Cap visible toasts.
        return next.slice(-MAX_TOASTS);
      });

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toast.toastId));
        toastTimersRef.current.delete(toast.toastId);
      }, TOAST_TTL_MS);
      toastTimersRef.current.set(toast.toastId, timer);

      if (soundEnabled) playNotificationSound();
      if (browserNotifyEnabled) {
        sendBrowserNotification(item.title, {
          body: item.body,
          tag: item.notificationId,
          href: buildHref(item),
        });
      }
    });
  }, [on, soundEnabled, browserNotifyEnabled]);

  // Cleanup toast timers on unmount.
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Reconnect reconciliation: when SSE flips false→true, refetch unread.
  useEffect(() => {
    if (connected && !wasConnectedRef.current) {
      void fetchUnread();
    }
    wasConnectedRef.current = connected;
  }, [connected, fetchUnread]);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, enabled ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (enabled) unlockAudio();
  }, []);

  const setBrowserNotifyEnabled = useCallback(async (enabled: boolean) => {
    if (!enabled) {
      setBrowserNotifyEnabledState(false);
      try {
        window.localStorage.setItem(BROWSER_PREF_KEY, '0');
      } catch {
        /* ignore */
      }
      return;
    }
    const { requestBrowserNotifyPermission } = await import('@/lib/realtime/browserNotify');
    const result = await requestBrowserNotifyPermission();
    const granted = result === 'granted';
    setBrowserNotifyEnabledState(granted);
    try {
      window.localStorage.setItem(BROWSER_PREF_KEY, granted ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const markRead = useCallback(
    async (notificationId: string) => {
      try {
        await fetch(
          `/api/super-admin/notifications/${encodeURIComponent(notificationId)}/read`,
          { method: 'POST', credentials: 'include' },
        );
        setUnreadCountState((u) => Math.max(0, u - 1));
        setNotificationsState((prev) =>
          prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n)),
        );
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/super-admin/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      setUnreadCountState(0);
      setNotificationsState((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
  }, []);

  // Imperative setters — used by list-fetch hydration (e.g. bell panel open).
  // Realtime SSE events still take precedence because they fire first for
  // new arrivals; these are only used to merge server-authoritative state.
  const setNotifications = useCallback((items: RealtimeNotification[]) => {
    setNotificationsState(items.slice(0, MAX_NOTIFICATIONS_KEPT));
  }, []);
  const setUnreadCount = useCallback((count: number) => {
    setUnreadCountState(Math.max(0, count));
  }, []);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      unreadCount,
      notifications,
      toasts,
      soundEnabled,
      browserNotifyEnabled,
      setSoundEnabled,
      setBrowserNotifyEnabled,
      markRead,
      markAllRead,
      dismissToast,
      setNotifications,
      setUnreadCount,
      sse: { connected, on },
    }),
    [
      connected,
      unreadCount,
      notifications,
      toasts,
      soundEnabled,
      browserNotifyEnabled,
      setSoundEnabled,
      setBrowserNotifyEnabled,
      markRead,
      markAllRead,
      dismissToast,
      setNotifications,
      setUnreadCount,
      on,
    ],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {/* The router is intentionally held by the provider so toasts can navigate without prop-drilling. */}
      <RealtimeToastBridge router={router} />
    </RealtimeContext.Provider>
  );
}

function RealtimeToastBridge({ router }: { router: ReturnType<typeof useRouter> }) {
  const ctx = useContext(RealtimeContext);
  // The bridge subscribes via a portal-like re-render and only renders toasts.
  if (!ctx) return null;
  return <RealtimeToastsContainer toasts={ctx.toasts} onDismiss={ctx.dismissToast} router={router} />;
}

function RealtimeToastsContainer({
  toasts,
  onDismiss,
  router,
}: {
  toasts: RealtimeToast[];
  onDismiss: (id: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex w-80 max-w-[90vw] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <button
          key={t.toastId}
          type="button"
          onClick={() => {
            onDismiss(t.toastId);
            router.push(t.href);
          }}
          className="rounded-xl border bg-white px-4 py-3 text-left shadow-lg transition hover:bg-slate-50 animate-in slide-in-from-right"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {t.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t.body}
          </p>
        </button>
      ))}
    </div>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}

/**
 * Shared SSE subscription — same shape as the legacy standalone
 * `useRealtimeStream` hook. Reads from the provider's single EventSource.
 *
 * Import this from `@/components/realtime/RealtimeProvider` instead of
 * `@/hooks/useRealtimeStream` to share the connection.
 */
export function useSharedRealtimeStream(): {
  connected: boolean;
  on: (kind: string, handler: (event: import('@/hooks/useRealtimeStream').RealtimeEvent) => void) => () => void;
} {
  const { sse } = useRealtime();
  return sse;
}
