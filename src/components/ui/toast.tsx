'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight imperative toast system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Session expired', { onAction: () => router.push('/login') });
 *
 * Toasts auto-dismiss after 4s, stack up to 3 visible, and animate in/out.
 */

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  description?: string;
  durationMs?: number;
  /** Optional action button (rendered as a link/button). */
  action?: {
    label: string;
    onClick: () => void;
  };
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'bg-card text-card-foreground',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  error: 'bg-red-50 text-red-900 border-red-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  info: 'bg-sky-50 text-sky-900 border-sky-200',
};

const VARIANT_DOT: Record<ToastVariant, string> = {
  default: 'bg-muted-foreground',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

interface ToastEntry extends ToastOptions {
  id: string;
  variant: ToastVariant;
  title: string;
}

interface ToastApi {
  show: (variant: ToastVariant, title: string, options?: ToastOptions) => string;
  default: (title: string, options?: ToastOptions) => string;
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  warning: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/** Imperative singleton so non-React code (fetch interceptor) can push toasts. */
let singletonApi: ToastApi | null = null;
let singletonSubscribe: ((listener: () => void) => () => void) | null = null;

/**
 * Push a toast from anywhere (including non-React code such as the
 * `fetch` 401 interceptor).
 */
export function pushToast(
  variant: ToastVariant,
  title: string,
  options?: ToastOptions,
): string {
  if (singletonApi) {
    return singletonApi.show(variant, title, options);
  }
  return '';
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback(
    (variant: ToastVariant, title: string, options?: ToastOptions) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, variant, title, ...options }]);
      const ttl = options?.durationMs ?? 4500;
      if (ttl > 0) {
        setTimeout(() => dismiss(id), ttl);
      }
      return id;
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      show,
      default: (t, o) => show('default', t, o),
      success: (t, o) => show('success', t, o),
      error: (t, o) => show('error', t, o),
      warning: (t, o) => show('warning', t, o),
      info: (t, o) => show('info', t, o),
      dismiss,
    }),
    [show, dismiss],
  );

  // Expose to non-React code (the 401 interceptor calls pushToast()).
  React.useEffect(() => {
    singletonApi = api;
    return () => {
      singletonApi = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (ctx) return ctx;
  // Fallback for callers mounted outside the provider (e.g. login page).
  return {
    show: pushToast,
    default: (t, o) => pushToast('default', t, o),
    success: (t, o) => pushToast('success', t, o),
    error: (t, o) => pushToast('error', t, o),
    warning: (t, o) => pushToast('warning', t, o),
    info: (t, o) => pushToast('info', t, o),
    dismiss: () => undefined,
  };
}

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: ToastEntry[];
  dismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.slice(-3).map((t) => (
        <div
          key={t.id}
          role={t.variant === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
            'animate-in slide-in-from-right fade-in duration-200',
            VARIANT_STYLES[t.variant],
          )}
        >
          <span
            aria-hidden="true"
            className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', VARIANT_DOT[t.variant])}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs opacity-80">{t.description}</p>
            )}
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium underline-offset-4 hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
