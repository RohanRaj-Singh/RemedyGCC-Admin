'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import type {
  TenantDashboardAccessSummary,
  TenantPasswordResetResult,
  TenantStatus,
} from '@/types';
import { tenantService } from '@/services/tenant-service';

interface TenantDashboardAccessPanelProps {
  tenantId: string;
  tenantStatus: TenantStatus;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAccessStatusLabel(summary: TenantDashboardAccessSummary | null): {
  label: string;
  tone: 'success' | 'warning' | 'muted';
  description: string;
} {
  if (!summary?.hasCredentials) {
    return {
      label: 'Not Configured',
      tone: 'warning',
      description: 'Create the tenant dashboard account to enable future dashboard access.',
    };
  }

  if (summary.user?.status === 'disabled') {
    return {
      label: 'Account Disabled',
      tone: 'muted',
      description: 'The dashboard user account is disabled by super admin.',
    };
  }

  if (summary.tenantStatus === 'draft') {
    return {
      label: 'Blocked In Draft',
      tone: 'warning',
      description: 'Credentials are ready, but dashboard access stays blocked until the tenant goes live.',
    };
  }

  if (summary.tenantStatus === 'disabled') {
    return {
      label: 'Blocked By Tenant',
      tone: 'muted',
      description: 'Tenant lifecycle is disabled, so dashboard access is paused.',
    };
  }

  if (summary.tenantStatus === 'archived') {
    return {
      label: 'Archived',
      tone: 'muted',
      description: 'Archived tenants cannot use the dashboard, even if credentials exist.',
    };
  }

  return {
    label: 'Access Enabled',
    tone: 'success',
    description: summary.user?.mustChangePassword
      ? 'The next sign-in requires a password change before dashboard access.'
      : 'Tenant dashboard access is active and ready for use.',
  };
}

const TONE_STYLES = {
  success: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    color: '#047857',
  },
  warning: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    color: '#b45309',
  },
  muted: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.22)',
    color: '#475569',
  },
} as const;

export function TenantDashboardAccessPanel({
  tenantId,
  tenantStatus,
}: TenantDashboardAccessPanelProps) {
  const [summary, setSummary] = useState<TenantDashboardAccessSummary | null>(null);
  const [resetResult, setResetResult] = useState<TenantPasswordResetResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    email: '',
    username: '',
    password: '',
  });

  const accessState = useMemo(
    () => getAccessStatusLabel(summary),
    [summary],
  );

  async function loadSummary() {
    try {
      setIsLoading(true);
      const result = await tenantService.getDashboardAccess(tenantId);
      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to load dashboard access.');
      }
      setSummary(result.data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard access.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [tenantId]);

  async function handleCreateAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResetResult(null);

    try {
      setIsSaving(true);
      const result = await tenantService.createDashboardAccess(tenantId, formState);
      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to create dashboard credentials.');
      }

      setSummary(result.data);
      setFormState({ email: '', username: '', password: '' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create dashboard credentials.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisableAccess() {
    setError(null);
    setResetResult(null);

    try {
      setIsSaving(true);
      const result = await tenantService.disableDashboardAccess(tenantId);
      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to disable dashboard access.');
      }
      setSummary(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to disable dashboard access.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReactivateAccess() {
    setError(null);
    setResetResult(null);

    try {
      setIsSaving(true);
      const result = await tenantService.reactivateDashboardAccess(tenantId);
      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to reactivate dashboard access.');
      }
      setSummary(result.data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reactivate dashboard access.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetPassword() {
    setError(null);

    try {
      setIsSaving(true);
      const result = await tenantService.resetDashboardPassword(tenantId);
      if (result.error || !result.data) {
        throw new Error(result.error || 'Unable to reset the dashboard password.');
      }

      setResetResult(result.data);
      await loadSummary();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reset the dashboard password.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border p-6" style={{ backgroundColor: '#fff', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading dashboard access
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-6"
      style={{ backgroundColor: '#fff', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Tenant Dashboard Access</h3>
          <p className="mt-1 text-sm text-slate-500">
            Single-owner dashboard credentials managed by super admin.
          </p>
        </div>

        <div
          className="rounded-full border px-4 py-2 text-sm font-medium"
          style={TONE_STYLES[accessState.tone]}
        >
          {accessState.label}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">{accessState.description}</p>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {resetResult ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Temporary password generated</p>
              <p className="mt-1 text-sm text-amber-800">
                Share this once with the tenant owner. The next sign-in will require a password change.
              </p>
              <code className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                {resetResult.temporaryPassword}
              </code>
            </div>
          </div>
        </div>
      ) : null}

      {!summary?.hasCredentials ? (
        <form onSubmit={handleCreateAccess} className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="dashboard-access-email">
                Dashboard Email
              </label>
              <input
                id="dashboard-access-email"
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                disabled={isSaving}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="dashboard-access-username">
                Username
              </label>
              <input
                id="dashboard-access-username"
                type="text"
                value={formState.username}
                onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                disabled={isSaving}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="dashboard-access-password">
              Initial Password
            </label>
            <input
              id="dashboard-access-password"
              type="password"
              value={formState.password}
              onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              disabled={isSaving}
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Use at least 12 characters with uppercase, lowercase, and a number.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Create Dashboard Credentials
          </button>

          {tenantStatus === 'draft' ? (
            <p className="text-xs text-amber-700">
              The credentials can be created now, but dashboard access will stay blocked until this tenant goes live.
            </p>
          ) : null}
        </form>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{summary.user?.email}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Username</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{summary.user?.username}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last Login</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDateTime(summary.user?.lastLoginAt)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Password State</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {summary.user?.mustChangePassword ? 'Change required' : 'Normal'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Reset Password
            </button>

            {summary.user?.status === 'disabled' ? (
              <button
                type="button"
                onClick={() => void handleReactivateAccess()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Reactivate Access
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleDisableAccess()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldOff className="h-4 w-4" />
                Disable Access
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
