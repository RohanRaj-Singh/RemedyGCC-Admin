'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ToastProvider } from '@/components/ui/toast';
import { installUnauthorizedHandler } from '@/lib/api-client';

export interface AdminInfo {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  admin: AdminInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  /** Admin info resolved server-side from the session cookie. */
  initialAdmin?: AdminInfo | null;
}

/**
 * Pages reachable without a session — used to short-circuit the auto-redirect
 * and prevent loops (e.g. when the user lands on /login after their session
 * expired, we must NOT immediately bounce them back to /login).
 */
const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/reset-password']);

function buildLoginRedirect(currentPath: string): string {
  const safePath = currentPath && currentPath.startsWith('/') ? currentPath : '/';
  const params = new URLSearchParams({ reason: 'session-expired', next: safePath });
  return `/login?${params.toString()}`;
}

export function AuthProvider({ children, initialAdmin }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminInfo | null>(initialAdmin ?? null);
  const [isLoading, setIsLoading] = useState(initialAdmin ? false : true);
  const redirectingRef = useRef(false);

  // Install the global 401 interceptor once on mount.
  useEffect(() => {
    installUnauthorizedHandler();
  }, []);

  // Auto-redirect to /login whenever the user loses their session.
  // - Skips public paths (login, etc.) to avoid bounce loops.
  // - Skips while still loading the initial auth check.
  // - Skips when we already started redirecting.
  useEffect(() => {
    if (isLoading) return;
    if (admin) return;
    if (redirectingRef.current) return;
    if (!pathname) return;
    if (PUBLIC_PATHS.has(pathname)) return;
    redirectingRef.current = true;
    router.replace(buildLoginRedirect(pathname));
  }, [admin, isLoading, pathname, router]);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAdmin(data.admin);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // If we were hydrated with an admin from the server, no need to re-check.
    if (initialAdmin) return;
    checkAuth();
  }, [checkAuth, initialAdmin]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setAdmin(data.admin);
      return { success: true };
    } catch {
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Continue with redirect even if API fails
    } finally {
      setAdmin(null);
      // Reset the redirect-guard so a future expired session can bounce again.
      redirectingRef.current = false;
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated: !!admin,
        login,
        logout,
        checkAuth,
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
