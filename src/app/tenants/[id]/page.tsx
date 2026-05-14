'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Edit,
  Loader2,
  RadioTower,
  Settings2,
  ShieldOff,
  Trash2,
} from 'lucide-react';
import type { RuntimeConfigOption, Tenant } from '@/modules/tenant/types';
import { tenantService } from '@/services/tenant-service';
import { BrandingPreviewCard } from '@/components/tenants';
import {
  getTenantHostname,
  getTenantPublishStateMeta,
  getTenantStatusMeta,
} from '@/modules/tenant/utils';

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TenantDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [runtimeConfigs, setRuntimeConfigs] = useState<RuntimeConfigOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreSubdomain, setRestoreSubdomain] = useState('');

  const statusMeta = useMemo(
    () => (tenant ? getTenantStatusMeta(tenant.status) : null),
    [tenant],
  );
  const publishStateMeta = useMemo(
    () => getTenantPublishStateMeta(tenant, tenant?.publishingPreview ?? null),
    [tenant],
  );

  const isDeleteAllowed = Boolean(
    tenant
    && tenant.status === 'draft'
    && tenant.runtimeConfigCount === 0
    && tenant.submissionCount === 0
    && !tenant.activeRuntimeConfigId,
  );

  const loadTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tenantResult, runtimeResult] = await Promise.all([
        tenantService.getById(tenantId),
        tenantService.getRuntimeConfigOptions(tenantId),
      ]);

      if (tenantResult.error || !tenantResult.data) {
        throw new Error(tenantResult.error || 'Tenant not found.');
      }
      if (runtimeResult.error) {
        throw new Error(runtimeResult.error);
      }

      setTenant(tenantResult.data);
      setRuntimeConfigs(runtimeResult.data ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load tenant.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadTenant();
  }, [loadTenant]);

  const updateStatus = useCallback(async (status: Tenant['status']) => {
    if (!tenant) {
      return;
    }

    try {
      setIsActing(true);
      setError(null);
      const { data, error: updateError } = await tenantService.update(tenant.id, { status });
      if (updateError || !data) {
        throw new Error(updateError || 'Failed to update tenant status.');
      }

      setTenant(data);
      await loadTenant();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update tenant.');
    } finally {
      setIsActing(false);
    }
  }, [loadTenant, tenant]);

  const handleDelete = useCallback(async () => {
    if (!tenant) {
      return;
    }

    const confirmationText = window.prompt(
      `Type "${tenant.slug}" to permanently delete this draft tenant.`,
      '',
    );

    if (!confirmationText) {
      return;
    }

    try {
      setIsActing(true);
      setError(null);
      const { error: deleteError } = await tenantService.delete(tenant.id, confirmationText);
      if (deleteError) {
        throw new Error(deleteError);
      }

      router.push('/tenants');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to delete tenant.');
    } finally {
      setIsActing(false);
    }
  }, [router, tenant]);

  const handleArchive = useCallback(async () => {
    if (!tenant) return;

    try {
      setIsActing(true);
      setError(null);
      const { error: archiveError } = await tenantService.archive(tenant.id);
      if (archiveError) {
        throw new Error(archiveError);
      }
      await loadTenant();
      setShowArchiveConfirm(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to archive tenant.');
    } finally {
      setIsActing(false);
    }
  }, [tenant, loadTenant]);

  const handleRestore = useCallback(async () => {
    if (!tenant) return;

    try {
      setIsActing(true);
      setError(null);
      const subdomain = restoreSubdomain.trim() || undefined;
      const { error: restoreError, data } = await tenantService.restore(tenant.id, subdomain);
      if (restoreError) {
        throw new Error(restoreError);
      }
      await loadTenant();
      setShowRestoreConfirm(false);
      setRestoreSubdomain('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to restore tenant.');
    } finally {
      setIsActing(false);
    }
  }, [tenant, restoreSubdomain, loadTenant]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
        <span className="ml-3" style={{ color: 'var(--foreground)' }}>
          Loading tenant...
        </span>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Tenant Not Found
        </h2>
        <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>
          The tenant you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 transition-colors"
          style={{ color: 'var(--foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tenants
        </Link>

        <Link
          href={`/tenants/${tenant.id}/edit`}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          <Edit className="h-4 w-4" />
          Edit Tenant
        </Link>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          {tenant.name}
        </h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          {getTenantHostname(tenant.subdomain)} | {publishStateMeta.label}
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'hsl(0 84% 60% / 0.1)',
            borderColor: 'var(--destructive)',
            color: 'var(--destructive)',
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Status', value: statusMeta?.label || tenant.status },
          { label: 'Submissions', value: String(tenant.submissionCount) },
          { label: 'Published Surveys', value: String(tenant.runtimeConfigCount) },
          {
            label: 'Updated',
            value: new Date(tenant.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border p-5 shadow-sm"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {item.label}
            </p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Tenant Overview
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Tenant Name
                </p>
                <p className="mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {tenant.name}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Tenant Slug
                </p>
                <p className="mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {tenant.slug}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Survey Address
                </p>
                <p className="mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {getTenantHostname(tenant.subdomain)}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Created
                </p>
                <p className="mt-1 font-medium" style={{ color: 'var(--foreground)' }}>
                  {formatDate(tenant.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <RadioTower className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Survey Status
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Current live state, publish readiness, and response history.
                </p>
              </div>
            </div>

            <div
              className="mt-5 rounded-xl border p-4"
              style={{
                borderColor:
                  publishStateMeta.tone === 'success'
                    ? 'rgba(34, 197, 94, 0.2)'
                    : publishStateMeta.tone === 'warning'
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(82, 82, 91, 0.2)',
                backgroundColor:
                  publishStateMeta.tone === 'success'
                    ? 'rgba(34, 197, 94, 0.08)'
                    : publishStateMeta.tone === 'warning'
                      ? 'rgba(245, 158, 11, 0.08)'
                      : 'rgba(82, 82, 91, 0.08)',
              }}
            >
              <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                {publishStateMeta.label}
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {publishStateMeta.description}
              </p>
            </div>

            {tenant.activeRuntimeConfig ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Scanner version: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.version}</strong>
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Questions: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.questionCount}</strong>
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Categories: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.scannerSummary.categoryCount}</strong>
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Historical submissions: <strong style={{ color: 'var(--foreground)' }}>{tenant.activeRuntimeConfig.submissionCount}</strong>
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Live since: <strong style={{ color: 'var(--foreground)' }}>{formatDate(tenant.activeRuntimeConfig.activatedAt)}</strong>
                    </p>
                    <p style={{ color: 'var(--muted-foreground)' }}>
                      Published surveys: <strong style={{ color: 'var(--foreground)' }}>{tenant.runtimeConfigCount}</strong>
                    </p>
                  </div>
                </div>

                {runtimeConfigs.length > 1 && (
                  <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      Published Survey History
                    </p>
                    <div className="mt-3 space-y-2">
                      {runtimeConfigs.map((runtimeConfig) => (
                        <div
                          key={runtimeConfig.runtimeConfigId}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                              {runtimeConfig.isActive ? 'Current Live Survey' : 'Published Survey'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {formatDate(runtimeConfig.publishedAt)} | {runtimeConfig.scannerSummary.version}
                            </p>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {runtimeConfig.submissionCount} submissions
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="mt-5 rounded-xl border p-4 text-sm"
                style={{
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: '#b45309' }} />
                  <p style={{ color: '#92400e' }}>
                    This tenant is not live yet. Choose a scanner and attribute template, then publish the survey.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <Settings2 className="h-5 w-5" style={{ color: '#1d4ed8' }} />
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Survey Setup
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Scanner and attribute template selected for the next publish.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Scanner
                </p>
                <p className="mt-2 font-medium" style={{ color: 'var(--foreground)' }}>
                  {tenant.draftScanner?.label || 'Not connected yet'}
                </p>
                {tenant.draftScanner?.description && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {tenant.draftScanner.description}
                  </p>
                )}
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Attribute Template
                </p>
                <p className="mt-2 font-medium" style={{ color: 'var(--foreground)' }}>
                  {tenant.draftAttributeTemplate?.label || 'Not connected yet'}
                </p>
                {tenant.draftAttributeTemplate?.description && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {tenant.draftAttributeTemplate.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div
            className="rounded-xl border p-6 shadow-sm"
            style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <ShieldOff className="h-5 w-5" style={{ color: '#b91c1c' }} />
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Actions
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Use safe actions that preserve survey history and submissions.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {tenant.status === 'active' && (
                <button
                  type="button"
                  onClick={() => void updateStatus('disabled')}
                  disabled={isActing}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(148, 163, 184, 0.18)', color: '#475569' }}
                >
                  Disable Survey
                </button>
              )}

              {tenant.status === 'disabled' && (
                <button
                  type="button"
                  onClick={() => void updateStatus('active')}
                  disabled={isActing || !tenant.activeRuntimeConfigId}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#166534' }}
                >
                  Reactivate Survey
                </button>
              )}

              {(tenant.status === 'disabled' || tenant.status === 'draft') && (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={isActing}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(82, 82, 91, 0.16)', color: '#3f3f46' }}
                >
                  Archive Tenant
                </button>
              )}

              {tenant.status === 'archived' && (
                <button
                  type="button"
                  onClick={() => setShowRestoreConfirm(true)}
                  disabled={isActing}
                  className="rounded-lg px-4 py-2.5 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#166534' }}
                >
                  Restore Tenant
                </button>
              )}

              {isDeleteAllowed && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={isActing}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c' }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Draft Tenant
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <BrandingPreviewCard
            branding={tenant.branding}
            title="Brand Preview"
            description="Preview how the live survey theme will appear to respondents."
          />

          {tenant.publishingReadiness?.warnings?.length ? (
            <div
              className="rounded-xl border p-5 shadow-sm"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                borderColor: 'rgba(245, 158, 11, 0.25)',
              }}
            >
              <h3 className="font-semibold" style={{ color: '#92400e' }}>
                Setup Guidance
              </h3>
              <div className="mt-3 space-y-2 text-sm" style={{ color: '#92400e' }}>
                {tenant.publishingReadiness.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          {(tenant.activeRuntimeConfig || runtimeConfigs.length > 0) && (
            <details
              className="rounded-xl border p-5 shadow-sm"
              style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
            >
              <summary
                className="cursor-pointer text-sm font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Technical Details
              </summary>
              <div className="mt-4 space-y-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {tenant.activeRuntimeConfig && (
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      Current live survey snapshot
                    </p>
                    <p>Runtime config ID: <code>{tenant.activeRuntimeConfig.runtimeConfigId}</code></p>
                    <p>Scanner version ID: <code>{tenant.activeRuntimeConfig.scannerSummary.scannerVersionId}</code></p>
                    <p>
                      Attribute template version ID:{' '}
                      <code>{tenant.activeRuntimeConfig.attributeTemplateSummary.attributeTemplateVersionId}</code>
                    </p>
                    <p>Branding version ID: <code>{tenant.activeRuntimeConfig.versionRefs.brandingVersionId}</code></p>
                    <p>Calculation version ID: <code>{tenant.activeRuntimeConfig.versionRefs.calculationVersionId}</code></p>
                  </div>
                )}

                {runtimeConfigs.length > 0 && (
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                      Published survey snapshots
                    </p>
                    <div className="mt-2 space-y-2">
                      {runtimeConfigs.map((runtimeConfig) => (
                        <div key={runtimeConfig.runtimeConfigId}>
                          <p>
                            <code>{runtimeConfig.runtimeConfigId}</code> | {formatDate(runtimeConfig.publishedAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Archive Tenant</h3>
            <div className="text-sm text-gray-600 mb-6 space-y-2">
              <p>Archiving this tenant will:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Disable the live survey immediately</li>
                <li>Preserve all historical submissions and reports</li>
                <li>Remove the tenant from active operational workflows</li>
                <li>Release the current subdomain for future reuse</li>
                <li>Prevent respondents from accessing existing survey links</li>
              </ul>
              <p className="mt-3 font-medium text-gray-900">
                This action is reversible, but the released subdomain may no longer be available if reused later.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleArchive()}
                disabled={isActing}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {isActing ? 'Archiving...' : 'Archive Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Restore Tenant</h3>
            <div className="text-sm text-gray-600 mb-4">
              <p>Restore this archived tenant to make it operational again.</p>
              <p className="mt-2">The tenant will be restored in <strong>Disabled</strong> state and must be explicitly activated to go live.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Subdomain (optional)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Original subdomain may be taken. Leave blank to try original.
              </p>
              <input
                type="text"
                value={restoreSubdomain}
                onChange={(e) => setRestoreSubdomain(e.target.value)}
                placeholder={tenant?.subdomain?.replace(/^archived_.*_/, '') || 'new-subdomain'}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                {error}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRestoreConfirm(false); setError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleRestore()}
                disabled={isActing}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isActing ? 'Restoring...' : 'Restore Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
