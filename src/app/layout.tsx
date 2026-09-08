/**
 * Super Admin Dashboard - Root Layout
 * RemedyGCC Control Plane
 *
 * Resolves the current admin (via the session cookie) on the server so
 * the AuthProvider can hydrate with the right identity and the sidebar /
 * header user card don't flicker on first paint.
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeProvider';
import { DEFAULT_BRANDING } from '@/types/branding';
import { AppShell } from './AppShell';
import type { AdminInfo } from '@/context/AuthProvider';

export const metadata: Metadata = {
  title: 'RemedyGCC | Super Admin',
  description: 'Super Admin Control Panel for RemedyGCC Multi-tenant Platform',
};

const SESSION_COOKIE = 'admin_session';
const SESSION_API = '/api/auth/me';

/**
 * Look up the current admin via the session cookie. Runs server-side on
 * every request so the AuthProvider starts with the correct identity and
 * the user card renders on first paint. Returns null on failure (no cookie,
 * expired, or server error) — the AuthProvider will then re-check on mount.
 */
async function resolveInitialAdmin(): Promise<AdminInfo | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;
  try {
    // Server-side fetch: same origin, so we pass the cookie explicitly.
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ?? '3001';
    const baseUrl = `${protocol}://${host}:${port}`;
    const res = await fetch(`${baseUrl}${SESSION_API}`, {
      headers: { Cookie: `${SESSION_COOKIE}=${session.value}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.admin as AdminInfo | undefined) ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialAdmin = await resolveInitialAdmin();
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider defaultBranding={DEFAULT_BRANDING}>
          <AppShell initialAdmin={initialAdmin}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
