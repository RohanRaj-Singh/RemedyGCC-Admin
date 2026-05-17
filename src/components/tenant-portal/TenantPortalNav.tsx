'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/reports', label: 'Reports' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const;

export function TenantPortalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[rgba(15,118,110,0.12)] text-teal-900'
                : 'bg-white text-slate-600 hover:bg-slate-100',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
