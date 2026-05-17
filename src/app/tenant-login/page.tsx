'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, LockKeyhole, UserRound } from 'lucide-react';

function getSafeNextPath(nextPath: string | null): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/dashboard';
  }

  return nextPath;
}

function TenantLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(
    () => getSafeNextPath(searchParams.get('next')),
    [searchParams],
  );

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/tenant-auth/me', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        router.replace(payload.redirectTo ?? nextPath);
      } catch {
        // Intentionally ignored so the login form can render.
      } finally {
        setIsLoading(false);
      }
    }

    void checkSession();
  }, [nextPath, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Email or username is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tenant-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          identifier,
          password,
          next: nextPath,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? 'Unable to sign in.');
        return;
      }

      router.replace(payload.redirectTo ?? nextPath);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#effcf8_0%,#f8fafc_100%)]">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
          Checking session
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dff7f0_0%,#f7fafc_40%,#ffffff_100%)] px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2.5rem] border border-[rgba(15,118,110,0.12)] bg-[linear-gradient(160deg,#0f766e_0%,#0f3d44_100%)] p-10 text-white shadow-xl">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-teal-100">
              RemedyGCC
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Tenant dashboard access for one accountable owner.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-teal-50/90">
              This workspace is purpose-built for tenant dashboards, analytics, reports, and future exports. It does not expose scanner building, publishing, or super admin controls.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5">
                <p className="text-sm font-medium text-white">Secure session model</p>
                <p className="mt-2 text-sm leading-6 text-teal-50/80">
                  HttpOnly cookies, server-side sessions, and bcrypt-backed credential checks.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5">
                <p className="text-sm font-medium text-white">Operationally simple</p>
                <p className="mt-2 text-sm leading-6 text-teal-50/80">
                  One dashboard owner account per tenant, provisioned and managed by super admin.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.25rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
            <div className="mb-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(15,118,110,0.1)]">
                <LockKeyhole className="h-6 w-6 text-teal-700" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-900">Tenant sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use the dashboard account created for your organization.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-slate-700">
                  Email or username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 px-11 py-3.5 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                    placeholder="owner@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <LockKeyhole className="h-4 w-4" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl border border-slate-200 px-11 py-3.5 text-slate-900 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-4 py-3.5 font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? 'Signing in' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Forgot password?
              <span className="ml-1 font-medium text-slate-900">
                Contact your RemedyGCC administrator for a dashboard password reset.
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function TenantLoginPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#effcf8_0%,#f8fafc_100%)]">
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
            Preparing tenant sign in
          </div>
        </div>
      )}
    >
      <TenantLoginPageContent />
    </Suspense>
  );
}
