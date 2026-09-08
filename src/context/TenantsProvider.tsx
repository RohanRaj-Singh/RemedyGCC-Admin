'use client';

/**
 * Shared tenants cache for the Super Admin authenticated shell.
 *
 * PA2-A item 4: previously three pages (Claims & Billing list, Invoices list,
 * Invoice detail) each had their own `useEffect(() => fetch('/api/super-admin/tenants'))`,
 * meaning every workspace navigation re-fetched the full tenant list. This
 * provider mounts once under `(authenticated)/layout.tsx` and serves
 * { id, name } tuples from a single in-memory cache. Refresh is opt-in via
 * `refresh()` so that detail pages (which can mutate tenant data through
 * other routes) can force a refetch after a successful write.
 *
 * PA5 verification: confirmed that the P0 cross-page tenants redundancy
 * flagged in the PA1 audit is fully addressed by this provider. The
 * financial workspaces (`/reimbursements`, `/invoices`, `/invoices/[id]`)
 * all consume `useTenants()` from this provider. No financial page
 * independently fetches `/api/super-admin/tenants`. The standalone
 * `/tenants` page (the management surface for create / update / delete)
 * legitimately needs the full tenant record plus the dashboard stats; it
 * continues to use `tenantService.getAll()` and `getDashboardStats()`
 * directly. Forcing it through the same provider would either drop the
 * extra fields the management page needs or duplicate the call — neither
 * is the simpler correct answer.
 *
 * The cache holds lightweight `TenantOption` summaries only. Detail screens
 * that need the full tenant record continue to call the dedicated detail
 * endpoints — this provider exists purely to stop the repeated identical
 * list fetches across the four workspaces in the (authenticated) group.
 *
 * Tenant mutations go through write endpoints that already invalidate the
 * server cache; the client provider simply refetches when asked.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface TenantOption {
  id: string;
  name: string;
}

interface TenantsContextValue {
  tenants: TenantOption[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TenantsContext = createContext<TenantsContextValue | undefined>(undefined);

export function TenantsProvider({ children }: { children: ReactNode }) {
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Avoid duplicate concurrent fetches if multiple consumers mount quickly.
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (inflight.current) return inflight.current;
    const run = (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/super-admin/tenants', { credentials: 'include' });
        if (!res.ok) throw new Error(`Tenants request failed: ${res.status}`);
        const data: Array<{ id: string; name: string }> = await res.json();
        setTenants(data.map((t) => ({ id: t.id, name: t.name })));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tenants');
      } finally {
        setIsLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<TenantsContextValue>(
    () => ({ tenants, isLoading, error, refresh: load }),
    [tenants, isLoading, error, load],
  );

  return <TenantsContext.Provider value={value}>{children}</TenantsContext.Provider>;
}

export function useTenants(): TenantsContextValue {
  const ctx = useContext(TenantsContext);
  if (ctx === undefined) {
    throw new Error('useTenants must be used within a TenantsProvider');
  }
  return ctx;
}
