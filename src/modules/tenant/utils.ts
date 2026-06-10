import { type BrandingConfig, validateBrandingConfig } from '@/types/branding';
import type { Tenant, TenantPublishingPreview, TenantStatus } from './types';

export const RESERVED_TENANT_IDENTIFIERS = [
  'admin',
  'api',
  'www',
  'dashboard',
  'root',
] as const;

const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DNS_LABEL_LENGTH = 63;
const MIN_SUBDOMAIN_LENGTH = 2;

export interface IdentifierValidationResult {
  normalized: string;
  errors: string[];
  warnings: string[];
}

export function normalizeTenantIdentifierInput(value: string): string {
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

export function validateTenantIdentifier(
  value: string,
  fieldLabel: 'Slug' | 'Subdomain',
): IdentifierValidationResult {
  const normalized = normalizeTenantIdentifierInput(value);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!normalized) {
    errors.push(`${fieldLabel} is required.`);
  }

  if (normalized.length > MAX_DNS_LABEL_LENGTH) {
    errors.push(`${fieldLabel} must be 63 characters or fewer.`);
  }

  if (normalized && !IDENTIFIER_PATTERN.test(normalized)) {
    errors.push(`${fieldLabel} must be lowercase, URL-safe, and DNS-safe.`);
  }

  if (
    RESERVED_TENANT_IDENTIFIERS.includes(
      normalized as (typeof RESERVED_TENANT_IDENTIFIERS)[number],
    )
  ) {
    errors.push(`${fieldLabel} "${normalized}" is reserved and cannot be used.`);
  }

  if (value !== normalized) {
    warnings.push(`${fieldLabel} was normalized to a lowercase DNS-safe value.`);
  }

  return { normalized, errors, warnings };
}

export function normalizeTenantSlugInput(value: string): string {
  return normalizeTenantIdentifierInput(value);
}

export function normalizeTenantSubdomainInput(value: string): string {
  return normalizeTenantIdentifierInput(value);
}

export function validateTenantSlug(value: string): IdentifierValidationResult {
  return validateTenantIdentifier(value, 'Slug');
}

export function validateTenantSubdomain(value: string): IdentifierValidationResult {
  const result = validateTenantIdentifier(value, 'Subdomain');

  if (result.normalized && result.normalized.length < MIN_SUBDOMAIN_LENGTH) {
    result.errors.push(`Subdomain must be at least ${MIN_SUBDOMAIN_LENGTH} characters.`);
  }

  return result;
}

export function getTenantRootDomain(): string {
  const configuredRootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() ||
    process.env.ROOT_DOMAIN?.trim();

  return configuredRootDomain || 'remedygcc.com';
}

export function getTenantHostnameSuffix(): string {
  return `.${getTenantRootDomain()}`;
}

export function getTenantHostname(subdomain: string): string {
  return `${subdomain}.${getTenantRootDomain()}`;
}

/**
 * Check whether a tenant's slug and subdomain are locked.
 *
 * - `active` tenants have live survey URLs — changing the address would
 *   break access for respondents currently taking the survey.
 * - `archived` tenants are immutable record-keeping snapshots.
 *
 * `draft` and `disabled` tenants can always update their slug/subdomain
 * regardless of past publishes or submissions.
 */
export function isTenantIdentityLocked(
  tenant: Pick<Tenant, 'status'> | null | undefined,
): boolean {
  if (!tenant) {
    return false;
  }

  return tenant.status === 'active' || tenant.status === 'archived';
}

export function getTenantStatusMeta(status: TenantStatus): {
  label: string;
  description: string;
} {
  switch (status) {
    case 'draft':
      return {
        label: 'Draft Setup',
        description: 'This tenant setup is incomplete and not available to respondents yet.',
      };
    case 'active':
      return {
        label: 'Live Survey',
        description: 'This survey is live and accessible to respondents.',
      };
    case 'disabled':
      return {
        label: 'Disabled',
        description: 'Survey access is temporarily disabled while preserving all submissions and history.',
      };
    case 'archived':
      return {
        label: 'Archived',
        description: 'This tenant is archived for record-keeping and protected from further changes.',
      };
    default:
      return {
        label: status,
        description: '',
      };
  }
}

export function getTenantPublishStateMeta(
  tenant: Pick<Tenant, 'status' | 'activeRuntimeConfigId'> | null | undefined,
  preview?: Pick<TenantPublishingPreview, 'isReady'> | null,
): {
  label: string;
  description: string;
  tone: 'warning' | 'success' | 'muted';
} {
  if (!tenant) {
    return {
      label: 'Draft Setup',
      description: 'This tenant setup is incomplete and not available to respondents yet.',
      tone: 'warning',
    };
  }

  if (tenant.status === 'archived') {
    return {
      label: 'Archived',
      description: 'This tenant is archived for record-keeping and protected from further changes.',
      tone: 'muted',
    };
  }

  if (tenant.status === 'disabled') {
    return {
      label: 'Survey Disabled',
      description: 'Survey access is temporarily disabled while preserving all submissions and history.',
      tone: 'muted',
    };
  }

  if (tenant.status === 'active' && tenant.activeRuntimeConfigId) {
    return {
      label: 'Live Survey Active',
      description: 'This survey is live and accessible to respondents.',
      tone: 'success',
    };
  }

  if (preview?.isReady) {
    return {
      label: 'Ready to Publish',
      description: 'The setup is ready. Publish the survey when you are ready to make it live.',
      tone: 'success',
    };
  }

  return {
    label: 'Draft Setup',
    description: 'This tenant setup is incomplete and not available to respondents yet.',
    tone: 'warning',
  };
}

export function getTenantBrandingWarnings(branding: Partial<BrandingConfig>): string[] {
  return validateBrandingConfig(branding).warnings;
}

export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function fnv1a(seed: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createFingerprint(value: unknown): string {
  const seed = stableStringify(value);
  return Array.from({ length: 8 }, (_, index) => fnv1a(`${index}:${seed}`)).join('');
}

export function createDeterministicId(prefix: string, fingerprint: string): string {
  return `${prefix}_${fingerprint.slice(0, 16)}`;
}
