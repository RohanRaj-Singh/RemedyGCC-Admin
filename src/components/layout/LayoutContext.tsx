'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface LayoutContextValue {
  /** Whether the desktop sidebar is collapsed to icon-only mode. */
  sidebarCollapsed: boolean;
  /** Whether the mobile nav drawer is open. */
  mobileNavOpen: boolean;
  /** Toggle / set the desktop sidebar collapsed state. */
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  /** Open / close the mobile drawer. */
  setMobileNavOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

const STORAGE_KEY = 'remedy:layout:sidebar-collapsed';

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Restore persisted collapsed state once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setSidebarCollapsedState(true);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Close the mobile drawer when the viewport grows past md.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    function onChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) setMobileNavOpen(false);
    }
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ⌘B / Ctrl+B → toggle the desktop sidebar. Don't fire inside form fields.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      e.preventDefault();
      toggleSidebarCollapsed();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebarCollapsed]);

  const value = useMemo<LayoutContextValue>(
    () => ({
      sidebarCollapsed,
      mobileNavOpen,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      setMobileNavOpen,
    }),
    [sidebarCollapsed, mobileNavOpen, setSidebarCollapsed, toggleSidebarCollapsed],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout(): LayoutContextValue {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return ctx;
}
