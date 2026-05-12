'use client';

import {
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import type {
  RuntimeConfigOption,
  Tenant,
  TenantPublishingPreview,
} from '../types';
import { getTenantPublishStateMeta } from '../utils';
import { isDefaultBranding, resolveBrandingConfig } from '@/types/branding';

interface TenantPublishingPanelProps {
  tenant: Tenant;
  preview: TenantPublishingPreview | null | undefined;
  runtimeConfigs: RuntimeConfigOption[];
  onPublish: () => void;
  onActivate: (runtimeConfigId: string) => void;
  onDisable: () => void;
  onReactivate: () => void;
  onArchive: () => void;
  isPublishing?: boolean;
  activatingId?: string | null;
  isUpdatingStatus?: boolean;
}

const STATE_STYLES = {
  warning: {
    bg: 'rgba(245, 158, 11, 0.12)',
    color: '#92400e',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.12)',
    color: '#166534',
    border: 'rgba(34, 197, 94, 0.22)',
  },
  muted: {
    bg: 'rgba(82, 82, 91, 0.12)',
    color: '#3f3f46',
    border: 'rgba(82, 82, 91, 0.2)',
  },
} as const;

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not published yet';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getBrandingLabel(tenant: Tenant): string {
  if (isDefaultBranding(tenant.branding)) {
    return 'Default theme';
  }

  const resolved = resolveBrandingConfig(tenant.branding);
  return resolved.appName?.trim() ? `${resolved.appName} theme` : 'Custom theme';
}

function getPreviewQuestionCount(preview: TenantPublishingPreview | null | undefined): number {
  if (!preview?.runtimeConfig) {
    return 0;
  }

  return preview.runtimeConfig.scannerVersion.categories.reduce(
    (total, category) =>
      total
      + category.subdomains.reduce(
        (subdomainTotal, subdomain) => subdomainTotal + subdomain.questions.length,
        0,
      ),
    0,
  );
}

export function TenantPublishingPanel({
  tenant,
  preview,
  runtimeConfigs,
  onPublish,
  onActivate,
  onDisable,
  onReactivate,
  onArchive,
  isPublishing,
  activatingId,
  isUpdatingStatus,
}: TenantPublishingPanelProps) {
  const publishState = getTenantPublishStateMeta(tenant, preview);
  const publishStateStyle = STATE_STYLES[publishState.tone];
  const blockingIssues = preview?.issues.filter((issue) => issue.blocking) ?? [];
  const canActivateExistingMatch = Boolean(
    preview?.existingMatchRuntimeConfigId && tenant.status !== 'archived',
  );
  const previewQuestionCount = getPreviewQuestionCount(preview);

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border p-6 shadow-sm"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: publishStateStyle.bg }}
              >
                {publishState.tone === 'success' ? (
                  <ShieldCheck className="h-5 w-5" style={{ color: publishStateStyle.color }} />
                ) : (
                  <AlertTriangle className="h-5 w-5" style={{ color: publishStateStyle.color }} />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  Publish State
                </h3>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  Save your setup, review the survey preview, then publish when you are ready to go live.
                </p>
              </div>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: publishStateStyle.border,
                backgroundColor: publishStateStyle.bg,
              }}
            >
              <span
                className="inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{ backgroundColor: '#ffffff', color: publishStateStyle.color }}
              >
                {publishState.label}
              </span>
              <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {publishState.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canActivateExistingMatch && preview?.existingMatchRuntimeConfigId && (
              <button
                type="button"
                onClick={() => onActivate(preview.existingMatchRuntimeConfigId as string)}
                disabled={activatingId === preview.existingMatchRuntimeConfigId}
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                  backgroundColor: 'transparent',
                  opacity: activatingId === preview.existingMatchRuntimeConfigId ? 0.6 : 1,
                }}
              >
                <RefreshCcw className="h-4 w-4" />
                {activatingId === preview.existingMatchRuntimeConfigId
                  ? 'Updating Live Survey...'
                  : 'Use Existing Published Survey'}
              </button>
            )}

            <button
              type="button"
              onClick={onPublish}
              disabled={!preview?.isReady || isPublishing || tenant.status === 'archived'}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
                opacity:
                  !preview?.isReady || isPublishing || tenant.status === 'archived' ? 0.55 : 1,
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              {isPublishing ? 'Publishing Survey...' : 'Publish Survey'}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(tenant.status === 'active' || tenant.status === 'disabled') && (
            <button
              type="button"
              onClick={tenant.status === 'active' ? onDisable : onReactivate}
              disabled={isUpdatingStatus || (tenant.status === 'disabled' && !tenant.activeRuntimeConfigId)}
              className="rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-55"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
              }}
            >
              {isUpdatingStatus
                ? 'Updating survey access...'
                : tenant.status === 'active'
                  ? 'Disable Survey'
                  : 'Reactivate Survey'}
            </button>
          )}

          {(tenant.status === 'draft' || tenant.status === 'disabled') && (
            <button
              type="button"
              onClick={onArchive}
              disabled={isUpdatingStatus}
              className="rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-55"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
              }}
            >
              {isUpdatingStatus ? 'Archiving...' : 'Archive Tenant'}
            </button>
          )}
        </div>
      </div>

      <div
        className="rounded-xl border p-6 shadow-sm"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
      >
        <div className="space-y-2">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Survey Publish Preview
          </h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Review the survey setup that will go live when you publish.
          </p>
        </div>

        {preview?.runtimeConfig ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: 'Scanner', value: tenant.draftScanner?.label || 'Not selected' },
              { label: 'Attribute Template', value: tenant.draftAttributeTemplate?.label || 'Not selected' },
              { label: 'Branding', value: getBrandingLabel(tenant) },
              { label: 'Questions', value: String(previewQuestionCount) },
              { label: 'Categories', value: String(preview.runtimeConfig.scannerVersion.categories.length) },
              { label: 'Status', value: preview.isReady ? 'Ready to Publish' : 'Needs Attention' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 99%)' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mt-5 rounded-xl border p-4 text-sm"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.25)',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
            }}
          >
            <p style={{ color: '#92400e' }}>
              Finish the setup above to generate a publish preview for this survey.
            </p>
          </div>
        )}

        {blockingIssues.length > 0 && (
          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor: 'rgba(239, 68, 68, 0.25)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: '#b91c1c' }}>
              What needs attention
            </p>
            <div className="mt-2 space-y-1 text-sm" style={{ color: '#b91c1c' }}>
              {blockingIssues.map((issue) => (
                <p key={`${issue.code}-${issue.path}`}>{issue.message}</p>
              ))}
            </div>
          </div>
        )}

        {(preview?.warnings.length ?? 0) > 0 && (
          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor: 'rgba(245, 158, 11, 0.35)',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
              Helpful notes
            </p>
            <div className="mt-2 space-y-1 text-sm" style={{ color: '#92400e' }}>
              {preview?.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="rounded-xl border p-6 shadow-sm"
        style={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)' }}
          >
            <History className="h-4 w-4" style={{ color: '#1d4ed8' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Published Surveys
            </h3>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Published surveys stay available for safe reactivation and history lookup.
            </p>
          </div>
        </div>

        {runtimeConfigs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No published surveys exist for this tenant yet.
          </p>
        ) : (
          <div className="space-y-3">
            {runtimeConfigs.map((runtimeConfig) => {
              const canActivate =
                runtimeConfig.status === 'published' && tenant.status !== 'archived';

              return (
                <div
                  key={runtimeConfig.runtimeConfigId}
                  className="rounded-xl border p-4"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 99%)' }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {runtimeConfig.isActive ? 'Current Live Survey' : 'Published Survey'}
                        </p>
                        <span
                          className="inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: runtimeConfig.isActive
                              ? 'rgba(34, 197, 94, 0.12)'
                              : 'rgba(59, 130, 246, 0.12)',
                            color: runtimeConfig.isActive ? '#166534' : '#1d4ed8',
                          }}
                        >
                          {runtimeConfig.isActive ? 'Live' : 'Stored'}
                        </span>
                      </div>

                      <div className="grid gap-1 text-xs md:grid-cols-2" style={{ color: 'var(--muted-foreground)' }}>
                        <p>Published: {formatDate(runtimeConfig.publishedAt)}</p>
                        <p>Live since: {formatDate(runtimeConfig.activatedAt)}</p>
                        <p>Scanner version: {runtimeConfig.scannerSummary.version}</p>
                        <p>Questions: {runtimeConfig.scannerSummary.questionCount}</p>
                        <p>Categories: {runtimeConfig.scannerSummary.categoryCount}</p>
                        <p>Historical submissions: {runtimeConfig.submissionCount}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onActivate(runtimeConfig.runtimeConfigId)}
                        disabled={!canActivate || activatingId === runtimeConfig.runtimeConfigId}
                        className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-55"
                        style={{
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)',
                          backgroundColor: 'transparent',
                        }}
                      >
                        {activatingId === runtimeConfig.runtimeConfigId
                          ? 'Making Live...'
                          : runtimeConfig.isActive
                            ? 'Current Live Survey'
                            : 'Make Live'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(preview?.runtimeConfig || runtimeConfigs.length > 0 || tenant.activeRuntimeConfig) && (
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
                <p>
                  Attribute template version ID:{' '}
                  <code>{tenant.activeRuntimeConfig.attributeTemplateSummary.attributeTemplateVersionId}</code>
                </p>
                <p>
                  Scanner version ID: <code>{tenant.activeRuntimeConfig.scannerSummary.scannerVersionId}</code>
                </p>
                <p>
                  Branding version ID: <code>{tenant.activeRuntimeConfig.versionRefs.brandingVersionId}</code>
                </p>
                <p>
                  Calculation version ID: <code>{tenant.activeRuntimeConfig.versionRefs.calculationVersionId}</code>
                </p>
              </div>
            )}

            {preview?.runtimeConfig && (
              <div>
                <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  Next publish snapshot
                </p>
                <p>Runtime config ID: <code>{preview.runtimeConfig.runtimeConfigId}</code></p>
                <p>
                  Attribute template version ID:{' '}
                  <code>{preview.runtimeConfig.versionRefs.attributeTemplateVersionId}</code>
                </p>
                <p>
                  Branding version ID: <code>{preview.runtimeConfig.versionRefs.brandingVersionId}</code>
                </p>
                <p>
                  Calculation version ID: <code>{preview.runtimeConfig.versionRefs.calculationVersionId}</code>
                </p>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
