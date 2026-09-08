'use client';

// ── Dashboard view — top-level layout composer (PA4 polish) ────────────────
// Four sections, four questions:
//
//   1. What needs my attention?        → AttentionQueue
//   2. Where is the work concentrated?  → ConcentrationBreakdown
//   3. What is the financial state?     → WorkflowState
//   4. What changed recently?           → ActivityTimeline
//
// The header (`DashboardHeader`) carries the page title + a one-line
// headline. The Refresh button is on the same baseline as the H1 so
// the operator does not have to scan the page to find it.
//
// PA4 polish:
//  - Section spacing is uniform (`space-y-7` rhythm). Sections no
//    longer have inconsistent internal padding.
//  - Focus refetch: when the window regains focus or visibility after
//    being hidden, the dashboard refetches the summary. Throttled to
//    one refetch per 30 seconds so a series of focus events does not
//    hammer the endpoint.
//  - The page is keyboard-friendly: tab order follows the visual
//    order, and the focus ring is the project's default.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import DashboardHeader from './DashboardHeader';
import AttentionQueue from './AttentionQueue';
import WorkflowState from './WorkflowState';
import ConcentrationBreakdown from './ConcentrationBreakdown';
import ActivityTimeline from './ActivityTimeline';
import DashboardSkeleton from './DashboardSkeleton';
import DashboardError from './DashboardError';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';

const FOCUS_REFETCH_MIN_INTERVAL_MS = 30_000;

export default function DashboardView() {
  const { data, isLoading, error, refresh } = useDashboardSummary();
  const lastFocusRefetchRef = useRef<number>(0);
  const [markingNotifications, setMarkingNotifications] = useState(false);

  // PA4 focus refetch: refetch the summary when the page regains focus
  // or visibility, throttled to one refetch per 30 seconds. The throttle
  // is a simple "last refetch timestamp" check — no timers, no state.
  useEffect(() => {
    function maybeRefetch() {
      const now = Date.now();
      if (now - lastFocusRefetchRef.current < FOCUS_REFETCH_MIN_INTERVAL_MS) return;
      lastFocusRefetchRef.current = now;
      void refresh();
    }
    function onFocus() {
      maybeRefetch();
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') maybeRefetch();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  // PA4 "Mark all read" for notifications. Owns the network call so the
  // single dashboard hook (above) can refresh the summary on success and
  // both the count on the header and the attention queue update.
  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (markingNotifications) return;
    setMarkingNotifications(true);
    try {
      await fetch('/api/super-admin/notifications/read-all', { method: 'POST' });
      await refresh();
    } catch {
      /* the API returns its own error path; the next refresh will reconcile */
    } finally {
      setMarkingNotifications(false);
    }
  }, [markingNotifications, refresh]);

  // Full-page error: the summary endpoint is the only network call on this
  // page, so a hard failure means nothing to render.
  if (!isLoading && error && !data) {
    return (
      <div className="flex flex-col gap-7">
        <DashboardError message={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <DashboardHeader summary={data} />
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:bg-gray-50"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <AttentionQueue
        summary={data}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        markingNotifications={markingNotifications}
      />
      <ConcentrationBreakdown summary={data} />
      <WorkflowState summary={data} />
      <ActivityTimeline summary={data} />
    </div>
  );
}
