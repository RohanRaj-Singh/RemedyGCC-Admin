'use client';

import { useRealtime } from '@/components/realtime/RealtimeProvider';

export interface NotificationItem {
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

export interface RealtimeHookValue {
  unreadCount: number;
  notifications: NotificationItem[];
  setNotifications: (items: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  connected: boolean;
}

/**
 * Public hook for notification UI. Wraps the RealtimeProvider's notification
 * state with explicit setters for imperative callers (e.g. syncing from
 * a list-fetch).
 */
export function useNotifications(): RealtimeHookValue {
  const ctx = useRealtime();
  return {
    unreadCount: ctx.unreadCount,
    notifications: ctx.notifications,
    setNotifications: ctx.setNotifications,
    setUnreadCount: ctx.setUnreadCount,
    markRead: ctx.markRead,
    markAllRead: ctx.markAllRead,
    connected: ctx.connected,
  };
}
