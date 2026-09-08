'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildBreadcrumbs } from './primitives';

/**
 * Renders a breadcrumb trail derived from the current pathname + the
 * canonical nav groups. Shows full context like:
 *   Home › Workspaces › Claims & Billing › Detail
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/';
  const crumbs = buildBreadcrumbs(pathname);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground',
        className,
      )}
    >
      <ol className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          const isFirst = idx === 0;
          return (
            <Fragment key={crumb.href}>
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              )}
              <li className="flex min-w-0 items-center gap-1.5">
                {isLast ? (
                  <span className="truncate font-medium text-foreground" aria-current="page">
                    {isFirst ? <Home className="h-3.5 w-3.5" aria-label={crumb.label} /> : crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className={cn(
                      'shrink-0 truncate transition-colors hover:text-foreground',
                      isFirst && 'inline-flex items-center',
                    )}
                  >
                    {isFirst ? <Home className="h-3.5 w-3.5" aria-label={crumb.label} /> : crumb.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
