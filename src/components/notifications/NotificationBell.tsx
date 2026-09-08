'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Inbox,
  Radio,
  RefreshCw,
  X,
} from 'lucide-react';
import { useNotifications, type NotificationItem } from '@/hooks/useNotifications';
import { useNotificationsApi } from '@/hooks/useNotificationsApi';
import { RealtimeSettings } from '@/components/realtime/RealtimeSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { labelForType, visualForType } from './notificationVisuals';

type Filter = 'all' | 'unread';

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86_400 * 7) return `${Math.floor(diff / 86_400)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Header notification bell.
 *
 * Renders inside a Radix DropdownMenu so the panel:
 *   - is portaled to <body> (escapes any stacking-context issues with the
 *     sticky/blurred header),
 *   - auto-flips when there's no room below the trigger,
 *   - gets collision-aware margins so it never goes off-screen,
 *   - closes on outside click / Escape / item select for free.
 */
export function NotificationBell() {
  const router = useRouter();
  const { unreadCount, notifications, connected } = useNotifications();
  const { refresh, markRead, markAllRead, loading, error, clearError } =
    useNotificationsApi();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // Refresh on open — guarantees a fresh list even if SSE hasn't fired yet.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  const handleItemClick = useCallback(
    (n: NotificationItem) => {
      if (!n.read) void markRead(n.notificationId);
      setOpen(false);
      if (n.type === 'claim_request' && n.requestId) {
        router.push(`/requests/${encodeURIComponent(n.requestId)}`);
        return;
      }
      router.push(`/reimbursements/${n.claimId}`);
    },
    [markRead, router],
  );

  const handleMarkAll = useCallback(() => void markAllRead(), [markAllRead]);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Close notifications' : 'Open notifications'}
            className="relative"
          >
            <Bell />
            {!connected && (
              <span
                className="absolute right-1 top-1 inline-flex h-2 w-2 rounded-full bg-amber-400 ring-2 ring-background"
                title="Reconnecting..."
                aria-hidden="true"
              />
            )}
            {unreadCount > 0 && (
              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums text-white',
                  unreadCount > 99 ? 'bg-red-600' : 'bg-red-500',
                )}
                aria-label={`${unreadCount} unread`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            'flex w-[min(26rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-xl border bg-card p-0 text-card-foreground shadow-2xl ring-1 ring-black/5',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  void refresh();
                }}
                disabled={loading}
                aria-label="Refresh notifications"
                className="text-muted-foreground"
              >
                <RefreshCw className={cn(loading && 'animate-spin')} />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    handleMarkAll();
                  }}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
                aria-label="Close"
                className="text-muted-foreground"
              >
                <X />
              </Button>
            </div>
          </div>

          {/* Filter tabs + connection status */}
          <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-4 py-2">
            <FilterPill
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label={`All${notifications.length ? ` \u00b7 ${notifications.length}` : ''}`}
            />
            <FilterPill
              active={filter === 'unread'}
              onClick={() => setFilter('unread')}
              label={`Unread${unreadCount ? ` \u00b7 ${unreadCount}` : ''}`}
            />
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Radio
                className={cn(
                  'h-3 w-3',
                  connected ? 'text-emerald-500' : 'text-amber-500',
                )}
              />
              {connected ? 'Live' : 'Reconnecting'}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 border-b border-border bg-red-50 px-4 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  clearError();
                }}
                className="shrink-0 text-red-700/70 hover:text-red-700"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* List */}
          <ScrollArea className="max-h-[26rem]">
            {loading && notifications.length === 0 ? (
              <NotificationListSkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState filter={filter} hasAny={notifications.length > 0} />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((n) => (
                  <NotificationRow
                    key={n.notificationId}
                    item={n}
                    onClick={() => handleItemClick(n)}
                  />
                ))}
              </ul>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2">
            <span className="text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread of ${notifications.length}`
                : `${notifications.length} total`}
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-7 px-1 text-xs"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push('/notifications');
              }}
            >
              View all
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <RealtimeSettings />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function NotificationRow({
  item,
  onClick,
}: {
  item: NotificationItem;
  onClick: () => void;
}) {
  const visual = visualForType(item.type);
  const Icon = visual.Icon;
  return (
    <li>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        className={cn(
          'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
          !item.read && 'bg-primary/[0.03]',
        )}
      >
        <span
          className={cn(
            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-inset',
            visual.bgClass,
            visual.ringClass,
          )}
          aria-hidden="true"
        >
          <Icon className={cn('h-4 w-4', visual.color)} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'truncate text-sm',
                item.read
                  ? 'font-medium text-muted-foreground'
                  : 'font-semibold text-foreground',
              )}
            >
              {item.title}
            </p>
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {formatRelative(item.createdAt)}
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-medium">
              {labelForType(item.type)}
            </Badge>
            {item.claimNumber && (
              <span className="text-[10px] text-muted-foreground">{item.claimNumber}</span>
            )}
          </div>
        </div>
        {!item.read && (
          <span
            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
      </button>
    </li>
  );
}

function NotificationListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ filter, hasAny }: { filter: Filter; hasAny: boolean }) {
  if (filter === 'unread' || hasAny) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">No unread notifications.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No notifications yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Activity from claims, payments, and requests will show up here.
        </p>
      </div>
    </div>
  );
}

export type { NotificationItem };
