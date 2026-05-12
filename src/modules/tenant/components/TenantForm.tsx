'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RadioTower } from 'lucide-react';
import type {
  Tenant,
  TenantSetupOption,
  TenantStatus,
} from '../types';
import {
  getTenantHostname,
  getTenantPublishStateMeta,
  getTenantStatusMeta,
  isTenantIdentityLocked,
  normalizeTenantSlugInput,
  normalizeTenantSubdomainInput,
  validateTenantSlug,
  validateTenantSubdomain,
} from '../utils';
import { cn } from '@/lib/utils';

interface TenantFormProps {
  tenant?: Tenant;
  scannerOptions?: TenantSetupOption[];
  attributeTemplateOptions?: TenantSetupOption[];
  formId?: string;
  showActions?: boolean;
  onSubmit: (data: {
    name: string;
    slug: string;
    subdomain: string;
    status: TenantStatus;
    draftScannerId: string | null;
    draftAttributeTemplateId: string | null;
  }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const STATE_STYLES = {
  warning: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.14)',
    badgeColor: '#92400e',
  },
  success: {
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.2)',
    badgeBg: 'rgba(34, 197, 94, 0.14)',
    badgeColor: '#166534',
  },
  muted: {
    bg: 'rgba(82, 82, 91, 0.08)',
    border: 'rgba(82, 82, 91, 0.2)',
    badgeBg: 'rgba(82, 82, 91, 0.14)',
    badgeColor: '#3f3f46',
  },
} as const;

export const TenantForm = memo(function TenantForm({
  tenant,
  scannerOptions = [],
  attributeTemplateOptions = [],
  formId,
  showActions = true,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: TenantFormProps) {
  const [name, setName] = useState(tenant?.name || '');
  const [slug, setSlug] = useState(tenant?.slug || '');
  const [subdomain, setSubdomain] = useState(tenant?.subdomain || tenant?.slug || '');
  const [draftScannerId, setDraftScannerId] = useState<string | null>(tenant?.draftScannerId || null);
  const [draftAttributeTemplateId, setDraftAttributeTemplateId] = useState<string | null>(
    tenant?.draftAttributeTemplateId || null,
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(tenant?.slug));
  const [subdomainTouched, setSubdomainTouched] = useState(Boolean(tenant?.subdomain || tenant?.slug));
  const [formError, setFormError] = useState('');

  useEffect(() => {
    setName(tenant?.name || '');
    setSlug(tenant?.slug || '');
    setSubdomain(tenant?.subdomain || tenant?.slug || '');
    setDraftScannerId(tenant?.draftScannerId || null);
    setDraftAttributeTemplateId(tenant?.draftAttributeTemplateId || null);
    setSlugTouched(Boolean(tenant?.slug));
    setSubdomainTouched(Boolean(tenant?.subdomain || tenant?.slug));
    setFormError('');
  }, [tenant]);

  const currentStatus = tenant?.status || 'draft';
  const identityLocked = isTenantIdentityLocked(tenant);
  const tenantLocked = tenant?.status === 'archived';
  const statusMeta = getTenantStatusMeta(currentStatus);
  const publishStateMeta = getTenantPublishStateMeta(tenant, tenant?.publishingPreview ?? null);
  const stateStyle = STATE_STYLES[publishStateMeta.tone];
  const slugValidation = useMemo(() => validateTenantSlug(slug), [slug]);
  const subdomainValidation = useMemo(
    () => validateTenantSubdomain(subdomain),
    [subdomain],
  );

  const labelStyle = 'block text-sm font-medium';
  const inputStyle =
    'w-full rounded-lg border border-[var(--input)] px-4 py-2.5 focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';
  const buttonStyle = 'rounded-lg px-6 py-2.5 font-medium transition-colors';

  const handleNameChange = (value: string) => {
    setName(value);

    if (!slugTouched && !identityLocked) {
      const normalized = normalizeTenantSlugInput(value);
      setSlug(normalized);
      if (!subdomainTouched) {
        setSubdomain(normalized);
      }
    }
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    const normalized = normalizeTenantSlugInput(value);
    setSlug(normalized);
    if (!subdomainTouched) {
      setSubdomain(normalized);
    }
    setFormError('');
  };

  const handleSubdomainChange = (value: string) => {
    setSubdomainTouched(true);
    setSubdomain(normalizeTenantSubdomainInput(value));
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

    if (subdomainValidation.errors.length > 0) {
      setFormError(subdomainValidation.errors[0]);
      return;
    }

    setFormError('');
    onSubmit({
      name,
      slug: slugValidation.normalized,
      subdomain: subdomainValidation.normalized,
      status: currentStatus,
      draftScannerId,
      draftAttributeTemplateId,
    });
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-8">
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
          Archived tenants are protected. Survey setup and live access are locked to preserve history.
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Tenant Info
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Set the tenant name and survey address used by admins and respondents.
          </p>
        </div>

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
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              required
              disabled={identityLocked || tenantLocked}
              className={cn(
                inputStyle,
                slugValidation.errors.length > 0 && 'border-[var(--destructive)]',
              )}
              placeholder="e.g., acme-health"
            />
            {slugValidation.warnings.map((warning) => (
              <p key={warning} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {warning}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <label htmlFor="subdomain" className={labelStyle} style={{ color: 'var(--foreground)' }}>
              Survey Address <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              id="subdomain"
              type="text"
              value={subdomain}
              onChange={(event) => handleSubdomainChange(event.target.value)}
              required
              disabled={identityLocked || tenantLocked}
              className={cn(
                inputStyle,
                subdomainValidation.errors.length > 0 && 'border-[var(--destructive)]',
              )}
              placeholder="e.g., acme-health"
            />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Survey hostname: <code>{getTenantHostname(subdomainValidation.normalized || 'tenant')}</code>
            </p>
            {identityLocked && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Slug and survey address lock after this tenant goes live or collects submissions.
              </p>
            )}
            {subdomainValidation.warnings.map((warning) => (
              <p key={warning} className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {warning}
              </p>
            ))}
          </div>

          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: stateStyle.border,
              backgroundColor: stateStyle.bg,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold"
                style={{
                  backgroundColor: stateStyle.badgeBg,
                  color: stateStyle.badgeColor,
                }}
              >
                {publishStateMeta.label}
              </span>
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {publishStateMeta.description}
            </p>
          </div>
        </div>
      </section>

      <section
        className="space-y-4 rounded-xl border p-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 99%)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'rgba(15, 118, 110, 0.1)' }}
          >
            <RadioTower className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Survey Setup
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Choose the scanner and attribute template that should be used when you publish this survey.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelStyle} style={{ color: 'var(--foreground)' }}>
              Scanner
            </label>
            <select
              value={draftScannerId ?? ''}
              onChange={(event) => setDraftScannerId(event.target.value || null)}
              disabled={tenantLocked}
              className={inputStyle}
            >
              <option value="">Select scanner</option>
              {scannerOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className={labelStyle} style={{ color: 'var(--foreground)' }}>
              Attribute Template
            </label>
            <select
              value={draftAttributeTemplateId ?? ''}
              onChange={(event) => setDraftAttributeTemplateId(event.target.value || null)}
              disabled={tenantLocked}
              className={inputStyle}
            >
              <option value="">Select attribute template</option>
              {attributeTemplateOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(!draftScannerId || !draftAttributeTemplateId) && (
          <div
            className="rounded-xl border p-4 text-sm"
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
      </section>

      {showActions && (
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
            {isLoading ? 'Saving...' : tenant ? 'Save Tenant' : 'Create Tenant'}
          </button>
        </div>
      )}
    </form>
  );
});
