'use client';

import { useRealtime } from '@/components/realtime/RealtimeProvider';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  className?: string;
}

/**
 * Live status indicator — pulses green when the SSE connection is up,
 * amber when reconnecting, and shows the runtime environment (dev/prod)
 * as a secondary chip.
 */
export function StatusPill({ className }: StatusPillProps) {
  const { connected } = useRealtime();
  const [env, setEnv] = useState<'production' | 'development'>('production');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hostname = window.location.hostname;
    const isDev =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.local') ||
      process.env.NODE_ENV === 'development';
    setEnv(isDev ? 'development' : 'production');
  }, []);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors sm:flex',
          connected
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
            : 'bg-amber-50 text-amber-800 ring-amber-600/20',
        )}
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              connected ? 'bg-emerald-500' : 'bg-amber-500',
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
        </span>
        {connected ? 'Live' : 'Reconnecting…'}
      </div>
      <div className="hidden items-center rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground lg:inline-flex">
        {env === 'development' ? 'Dev' : 'Prod'}
      </div>
    </div>
  );
}
