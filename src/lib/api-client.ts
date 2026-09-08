'use client';

import { pushToast } from '@/components/ui/toast';

/**
 * Global 401 / session-expired handler for the admin app.
 *
 * When any `/api/*` request returns 401 we:
 *   1. Push a clear "Your session expired" toast.
 *   2. Redirect to /login?reason=session-expired&next=<currentPath>.
 *
 * Guarded against infinite loops with a module-level flag and an allowlist
 * of paths that never trigger the redirect (login, auth endpoints, etc.).
 */

const REDIRECT_FLAG_KEY = '__remedyAuthRedirectInFlight';

const NEVER_REDIRECT_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/login',
  '/realtime/stream',
  '/api/realtime/stream',
];

function shouldRedirectFor(url: string): boolean {
  // Only redirect for API responses. Static assets, page navigation, etc. are
  // handled by the browser.
  if (!url.includes('/api/')) return false;
  return !NEVER_REDIRECT_PATHS.some((p) => url.includes(p));
}

function buildLoginRedirect(currentPath: string): string {
  const safePath = currentPath && currentPath.startsWith('/') ? currentPath : '/';
  const params = new URLSearchParams({ reason: 'session-expired', next: safePath });
  return `/login?${params.toString()}`;
}

/**
 * Returns true when the response is a session-expiry 401 — i.e. it is NOT
 * the expected 401 from the login endpoint itself (which has its own UI
 * handling). Only redirects for /api/* responses.
 */
export function handleUnauthorizedResponse(
  response: Response,
  requestUrl: string,
  currentPath: string,
): boolean {
  if (response.status !== 401) return false;
  if (!shouldRedirectFor(requestUrl)) return false;

  // Avoid recursion if multiple 401s come in while we're redirecting.
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, boolean | undefined>;
    if (w[REDIRECT_FLAG_KEY]) return true;
    w[REDIRECT_FLAG_KEY] = true;
  }

  if (typeof window !== 'undefined') {
    pushToast('warning', 'Your session has expired', {
      description: 'Please sign in again to continue.',
      durationMs: 6000,
      action: {
        label: 'Sign in',
        onClick: () => {
          window.location.assign(buildLoginRedirect(currentPath));
        },
      },
    });
    // Slight delay so the toast is visible before navigation.
    setTimeout(() => {
      window.location.assign(buildLoginRedirect(currentPath));
    }, 250);
  }

  return true;
}

/**
 * Wraps the native `fetch` so every call goes through the 401 handler.
 * Idempotent — safe to install more than once.
 */
export function installUnauthorizedHandler(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __remedyFetchWrapped?: boolean; fetch?: typeof fetch };
  if (w.__remedyFetchWrapped) return;
  w.__remedyFetchWrapped = true;

  const original = window.fetch.bind(window);
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await original(input, init);
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      // Use the current pathname; window.location is the source of truth.
      const currentPath = window.location.pathname + window.location.search;
      handleUnauthorizedResponse(response, url, currentPath);
    } catch {
      /* ignore — never let the interceptor crash a caller */
    }
    return response;
  };
}
