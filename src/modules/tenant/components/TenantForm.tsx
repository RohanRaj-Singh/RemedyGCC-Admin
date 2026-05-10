'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import type { RuntimeConfigOption, Tenant, TenantStatus } from '../types';
import {
  getTenantHostname,
  getTenantStatusMeta,
  isTenantSlugLocked,
  normalizeTenantSlugInput,
  validateTenantSlug,
} from '../utils';
import { cn } from '@/lib/utils';

interface TenantFormProps {
  tenant?: Tenant;
  runtimeConfigs?: RuntimeConfigOption[];
  onSubmit: (data: {
    name: string;
    slug: string;
    status: TenantStatus;
    activeRuntimeConfigId: string | null;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: TenantStatus[] = ['draft', 'active', 'disabled', 'archived'];

export const TenantForm = memo(function TenantForm({
  tenant,
  runtimeConfigs = [],
  onSubmit,
  onCancel,
  isLoading,
  error,
}: TenantFormProps) {
  const [name, setName] = useState(tenant?.name || '');
  const [slug, setSlug] = useState(tenant?.slug || '');
  const [status, setStatus] = useState<TenantStatus>(tenant?.status || 'draft');
  const [activeRuntimeConfigId, setActiveRuntimeConfigId] = useState<string | null>(
    tenant?.activeRuntimeConfigId || null,
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(tenant?.slug));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setName(tenant?.name || '');
    setSlug(tenant?.slug || '');
    setStatus(tenant?.status || 'draft');
    setActiveRuntimeConfigId(tenant?.activeRuntimeConfigId || null);
    setSlugTouched(Boolean(tenant?.slug));
    setFormError('');
  }, [tenant]);

  const slugLocked = isTenantSlugLocked(tenant);
  const tenantLocked = tenant?.status === 'archived';

  const slugValidation = useMemo(() => validateTenantSlug(slug), [slug]);
  const selectedRuntimeConfig = useMemo(
    () =>
      runtimeConfigs.find(
        (runtimeConfig) => runtimeConfig.runtimeConfigId === activeRuntimeConfigId,
      ) ?? null,
    [activeRuntimeConfigId, runtimeConfigs],
  );

  const labelStyle = 'block text-sm font-medium';
  const inputStyle =
    'w-full rounded-lg border border-[var(--input)] px-4 py-2.5 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';
  const buttonStyle = 'rounded-lg px-6 py-2.5 font-medium transition-colors';

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched && !slugLocked) {
      setSlug(normalizeTenantSlugInput(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(normalizeTenantSlugInput(value));
    setFormError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (tenantLocked) {
      return;
    }

    if (slugValidation.errors.length > 0) {
      setFormError(slugValidation.errors[0]);
      return;
    }

    if (status === 'active' && !activeRuntimeConfigId) {
      setFormError('Active tenants must link to a published runtime config.');
      return;
    }

    setFormError('');
    onSubmit({
      name,
      slug: slugValidation.normalized,
      status,
      activeRuntimeConfigId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(error || formError) && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'hsl(0 84% 60% / 0.1)',
            borderColor: 'var(--destructive)',
            color: 'var(--destructive)',
          }}
        >
          {error || formError}
        </div>
      )}

      {tenantLocked && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'rgba(82, 82, 91, 0.08)',
            borderColor: 'rgba(82, 82, 91, 0.25)',
            color: '#3f3f46',
          }}
        >
          Archived tenants are protected. Identity, status, and runtime links are locked to preserve historical runtime references.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className={labelStyle} style={{ color: 'var(--foreground)' }}>
            Tenant Name <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            required
            disabled={tenantLocked}
            className={inputStyle}
            placeholder="e.g., Acme Health"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className={labelStyle} style={{ color: 'var(--foreground)' }}>
            Tenant Slug <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              required
              disabled={slugLocked || tenantLocked}
              className={cn(
                inputStyle,
                slugValidation.errors.length > 0 && 'border-[var(--destructive)]',
              )}
              placeholder="e.g., acme-health"
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Runtime hostname: <code>{getTenantHostname(slugValidation.normalized || 'tenant')}</code>
          </p>
          {slugLocked && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Slug is locked after runtime publish or once the tenant leaves draft.
            </p>
          )}
          {slugValidation.warnings.map((warning) => (
            <p key={warning} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {warning}
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className={labelStyle} style={{ color: 'var(--foreground)' }}>
          Tenant Status
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {STATUS_OPTIONS.map((option) => {
            const meta = getTenantStatusMeta(option);
            const isSelected = status === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                disabled={tenantLocked}
                className={cn(
                  'rounded-xl border p-4 text-left transition-all',
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/50',
                  tenantLocked && 'cursor-not-allowed opacity-70',
                )}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {meta.label}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="space-y-4 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 99%)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(15, 118, 110, 0.1)' }}
          >
            <Link2 className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Runtime Config Linking
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Tenants activate published immutable runtime snapshots. Scanner and attribute versions are read-only through the linked runtime config.
            </p>
          </div>
        </div>

        {runtimeConfigs.length > 0 ? (
          <div className="space-y-3">
            <label className={labelStyle} style={{ color: 'var(--foreground)' }}>
              Active Runtime Config
            </label>
            <select
              value={activeRuntimeConfigId ?? ''}
              onChange={(event) => setActiveRuntimeConfigId(event.target.value || null)}
              disabled={tenantLocked}
              className={inputStyle}
            >
              <option value="">No active runtime config</option>
              {runtimeConfigs.map((runtimeConfig) => (
                <option key={runtimeConfig.runtimeConfigId} value={runtimeConfig.runtimeConfigId}>
                  {runtimeConfig.label}
                </option>
              ))}
            </select>

            {selectedRuntimeConfig && (
              <div
                className="rounded-xl border p-4 text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
              >
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  {selectedRuntimeConfig.runtimeConfigId}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    Scanner: <code>{selectedRuntimeConfig.versionRefs.scannerVersionId}</code>
                  </p>
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    Attributes: <code>{selectedRuntimeConfig.versionRefs.attributeTemplateVersionId}</code>
                  </p>
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    Calculation: <code>{selectedRuntimeConfig.versionRefs.calculationVersionId}</code>
                  </p>
                  <p style={{ color: 'var(--muted-foreground)' }}>
                    Branding: <code>{selectedRuntimeConfig.versionRefs.brandingVersionId}</code>
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="rounded-xl border p-4 text-sm"
            style={{ borderColor: 'rgba(245, 158, 11, 0.25)', backgroundColor: 'rgba(245, 158, 11, 0.08)' }}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" style={{ color: '#b45309' }} />
              <p style={{ color: '#92400e' }}>
                No published runtime configs are available for this tenant yet. Keep the tenant in draft or disabled until publish is completed.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={onCancel}
          className={buttonStyle}
          style={{
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || tenantLocked}
          className={buttonStyle}
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: isLoading || tenantLocked ? 0.55 : 1,
            cursor: isLoading || tenantLocked ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Saving...' : tenant ? 'Update Tenant' : 'Create Tenant'}
        </button>
      </div>
    </form>
  );
});
