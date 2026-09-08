/**
 * useDashboardSummary — single fetch hook for the redesigned dashboard.
 *
 * The dashboard renders one round-trip composed server-side at
 * `GET /api/super-admin/dashboard/summary`. Per-section errors are surfaced
 * upstream as a 502; this hook turns them into a typed error string.
 *
 * The hook does NOT poll. The dashboard has a "Refresh" button wired to
 * `refresh()`. Background refetch is intentionally absent — the financial
 * state doesn't change every few seconds, and stale data is less harmful
 * than the cost of polling every authenticated page render.
 */
import { useState, useEffect, useCallback } from 'react';
import type { DashboardSummary } from '@/lib/dashboard/types';

interface UseDashboardSummaryResult {
  data: DashboardSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboardSummary(): UseDashboardSummaryResult {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/dashboard/summary', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string | { message?: string } };
          if (typeof body?.error === 'string') detail = body.error;
          else if (body?.error?.message) detail = body.error.message;
        } catch {
          // Body wasn't JSON — keep the status-only message.
        }
        throw new Error(detail);
      }
      const payload = (await res.json()) as DashboardSummary;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, refresh: load };
}