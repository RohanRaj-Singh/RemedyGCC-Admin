'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider, type AdminInfo } from '@/context/AuthProvider';

interface AppShellProps {
  children: ReactNode;
  /**
   * Admin info resolved server-side from the session cookie. Passing this
   * as a prop avoids the post-mount auth flicker where the sidebar user
   * card and header user menu are empty until `useEffect` fires.
   */
  initialAdmin: AdminInfo | null;
}

const TENANT_SURFACE_PREFIXES = [
  '/tenant-login',
  '/dashboard',
  '/analytics',
  '/reports',
] as const;

function isTenantSurface(pathname: string): boolean {
  return TENANT_SURFACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function AppShell({ children, initialAdmin }: AppShellProps) {
  const pathname = usePathname();

  if (isTenantSurface(pathname ?? '')) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <AuthProvider initialAdmin={initialAdmin}>
      <div className="min-h-screen">{children}</div>
    </AuthProvider>
  );
}
