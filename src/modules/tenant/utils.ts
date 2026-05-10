import { type BrandingConfig, validateBrandingConfig } from '@/types/branding';
import type { Tenant, TenantStatus } from './types';

export const RESERVED_TENANT_SLUGS = ['admin', 'api', 'www', 'dashboard', 'root'] as const;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DNS_LABEL_LENGTH = 63;

export interface SlugValidationResult {
  normalized: string;
  errors: string[];
  warnings: string[];
}

export function normalizeTenantSlugInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, MAX_DNS_LABEL_LENGTH);
}

export function validateTenantSlug(value: string): SlugValidationResult {
  const normalized = normalizeTenantSlugInput(value);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!normalized) {
    errors.push('Slug is required.');
  }

  if (normalized.length > MAX_DNS_LABEL_LENGTH) {
    errors.push('Slug must be 63 characters or fewer.');
  }

  if (normalized && !SLUG_PATTERN.test(normalized)) {
    errors.push('Slug must be lowercase, URL-safe, and DNS-safe.');
  }

  if (RESERVED_TENANT_SLUGS.includes(normalized as (typeof RESERVED_TENANT_SLUGS)[number])) {
    errors.push(`Slug "${normalized}" is reserved and cannot be used.`);
  }

  if (normalized.includes('--')) {
    warnings.push('Consecutive hyphens are normalized automatically.');
  }

  if (value !== normalized) {
    warnings.push('Slug input was normalized to a lowercase DNS-safe value.');
  }

  return { normalized, errors, warnings };
}

export function getTenantHostname(slug: string): string {
  return `${slug}.remedygcc.com`;
}

export function isTenantSlugLocked(
  tenant: Pick<Tenant, 'status' | 'activeRuntimeConfigId'> | null | undefined,
): boolean {
  if (!tenant) {
    return false;
  }

  return Boolean(tenant.activeRuntimeConfigId) || tenant.status !== 'draft';
}

export function getTenantStatusMeta(status: TenantStatus): {
  label: string;
  description: string;
} {
  switch (status) {
    case 'draft':
      return {
        label: 'Draft',
        description: 'Private draft tenant. Not resolvable by the runtime app.',
      };
    case 'active':
      return {
        label: 'Active',
        description: 'Resolvable by the runtime app through the active runtime config.',
      };
    case 'disabled':
      return {
        label: 'Disabled',
        description: 'Runtime resolution blocked while keeping immutable published history.',
      };
    case 'archived':
      return {
        label: 'Archived',
        description: 'Historical tenant. Protected from destructive changes and public runtime access.',
      };
    default:
      return {
        label: status,
        description: '',
      };
  }
}

export function getTenantBrandingWarnings(branding: Partial<BrandingConfig>): string[] {
  return validateBrandingConfig(branding).warnings;
}
