'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/context/AuthProvider';

interface AppShellProps {
  children: ReactNode;
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

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  if (isTenantSurface(pathname)) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <AuthProvider>
      <div className="min-h-screen">{children}</div>
    </AuthProvider>
  );
}
