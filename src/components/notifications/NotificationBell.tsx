'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';

interface NotificationItem {
  notificationId: string;
  claimId: string;
  claimNumber?: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnread(data.count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const togglePanel = useCallback(async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;

    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/notifications?limit=20');
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/super-admin/notifications/${id}/read`, { method: 'POST' });
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const markAll = useCallback(async () => {
    try {
      await fetch('/api/super-admin/notifications/read-all', { method: 'POST' });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }, []);

  const handleItemClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.read) await markRead(n.notificationId);
      setOpen(false);
      router.push(`/reimbursements/${n.claimId}`);
    },
    [markRead, router],
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={togglePanel}
        aria-label="Notifications"
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[90vw] overflow-hidden rounded-xl border bg-white shadow-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Notifications
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="inline-flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--primary)' }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-8 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Loading…
              </p>
            )}
            {!loading && items.length === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-gray-300" />
                <p className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No notifications
                </p>
              </div>
            )}
            {items.map((n) => (
              <button
                key={n.notificationId}
                type="button"
                onClick={() => handleItemClick(n)}
                className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition hover:bg-slate-50 ${
                  n.read ? 'opacity-70' : ''
                }`}
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  {!n.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--primary)' }} />
                  )}
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {n.title}
                  </p>
                  <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                    {formatTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {n.body}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
