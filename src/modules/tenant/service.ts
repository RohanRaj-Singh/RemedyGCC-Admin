import {
  type BrandingConfig,
  resolveBrandingConfig,
  validateBrandingConfig,
} from '@/types/branding';
import type {
  CreateTenantDto,
  RuntimeConfigOption,
  RuntimeConfigStatus,
  Tenant,
  TenantPublishingReadiness,
  TenantRuntimeConfigReference,
  TenantStatus,
  UpdateTenantDto,
} from './types';
import {
  getTenantBrandingWarnings,
  isTenantSlugLocked,
  normalizeTenantSlugInput,
  validateTenantSlug,
} from './utils';

interface StoredTenantRecord {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  activeRuntimeConfigId: string | null;
  branding: BrandingConfig;
  createdAt: string;
  updatedAt: string;
  hasPendingChanges: boolean;
}

const runtimeConfigs: TenantRuntimeConfigReference[] = [
  {
    runtimeConfigId: 'runtimecfg_acme_2026_04_28',
    tenantId: 'tenant-acme-health',
    tenantSlug: 'acme-health',
    status: 'published',
    publishedAt: '2026-04-28T09:00:00.000Z',
    activatedAt: '2026-04-28T09:30:00.000Z',
    versionRefs: {
      scannerVersionId: 'scanner_v7',
      attributeTemplateVersionId: 'attr_v3',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v2',
    },
  },
  {
    runtimeConfigId: 'runtimecfg_acme_2026_05_08',
    tenantId: 'tenant-acme-health',
    tenantSlug: 'acme-health',
    status: 'draft',
    publishedAt: null,
    activatedAt: null,
    versionRefs: {
      scannerVersionId: 'scanner_v8',
      attributeTemplateVersionId: 'attr_v4',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v3',
    },
  },
  {
    runtimeConfigId: 'runtimecfg_techstart_2026_05_01',
    tenantId: 'tenant-techstart-care',
    tenantSlug: 'techstart-care',
    status: 'draft',
    publishedAt: null,
    activatedAt: null,
    versionRefs: {
      scannerVersionId: 'scanner_v3',
      attributeTemplateVersionId: 'attr_v2',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v1',
    },
  },
  {
    runtimeConfigId: 'runtimecfg_global_2026_04_12',
    tenantId: 'tenant-global-works',
    tenantSlug: 'global-works',
    status: 'published',
    publishedAt: '2026-04-12T07:00:00.000Z',
    activatedAt: '2026-04-12T08:00:00.000Z',
    versionRefs: {
      scannerVersionId: 'scanner_v5',
      attributeTemplateVersionId: 'attr_v3',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v2',
    },
  },
  {
    runtimeConfigId: 'runtimecfg_finance_2026_03_20',
    tenantId: 'tenant-finance-first',
    tenantSlug: 'finance-first',
    status: 'published',
    publishedAt: '2026-03-20T12:00:00.000Z',
    activatedAt: '2026-03-20T12:30:00.000Z',
    versionRefs: {
      scannerVersionId: 'scanner_v4',
      attributeTemplateVersionId: 'attr_v2',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v2',
    },
  },
  {
    runtimeConfigId: 'runtimecfg_carepoint_2026_05_02',
    tenantId: 'tenant-carepoint',
    tenantSlug: 'carepoint',
    status: 'published',
    publishedAt: '2026-05-02T10:00:00.000Z',
    activatedAt: '2026-05-02T11:00:00.000Z',
    versionRefs: {
      scannerVersionId: 'scanner_v6',
      attributeTemplateVersionId: 'attr_v4',
      calculationVersionId: 'calc_v1',
      brandingVersionId: 'brand_v2',
    },
  },
];

let tenants: StoredTenantRecord[] = [
  {
    id: 'tenant-acme-health',
    slug: 'acme-health',
    name: 'Acme Health',
    status: 'active',
    activeRuntimeConfigId: 'runtimecfg_acme_2026_04_28',
    branding: {
      appName: 'Acme Health',
      logoUrl: '/logos/acme-health.svg',
      primaryColor: '#0f766e',
      secondaryColor: '#115e59',
      faviconUrl: '/logos/acme-health-favicon.ico',
      fontFamily: 'IBM Plex Sans, sans-serif',
    },
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-04-28T09:30:00.000Z',
    hasPendingChanges: false,
  },
  {
    id: 'tenant-techstart-care',
    slug: 'techstart-care',
    name: 'TechStart Care',
    status: 'draft',
    activeRuntimeConfigId: null,
    branding: {
      appName: 'TechStart Care',
      primaryColor: '#7c3aed',
      logoUrl: '/logos/techstart-care.svg',
    },
    createdAt: '2026-02-18T11:00:00.000Z',
    updatedAt: '2026-05-01T14:30:00.000Z',
    hasPendingChanges: true,
  },
  {
    id: 'tenant-global-works',
    slug: 'global-works',
    name: 'Global Works',
    status: 'disabled',
    activeRuntimeConfigId: 'runtimecfg_global_2026_04_12',
    branding: {
      appName: 'Global Works',
      primaryColor: '#1d4ed8',
      secondaryColor: '#2563eb',
      faviconUrl: '/logos/global-works-favicon.ico',
    },
    createdAt: '2026-01-22T10:20:00.000Z',
    updatedAt: '2026-04-15T16:40:00.000Z',
    hasPendingChanges: false,
  },
  {
    id: 'tenant-finance-first',
    slug: 'finance-first',
    name: 'Finance First',
    status: 'archived',
    activeRuntimeConfigId: 'runtimecfg_finance_2026_03_20',
    branding: {
      appName: 'Finance First',
      logoUrl: '/logos/finance-first.svg',
      primaryColor: '#166534',
      secondaryColor: '#15803d',
      faviconUrl: '/logos/finance-first-favicon.ico',
      fontFamily: 'Source Sans 3, sans-serif',
    },
    createdAt: '2025-12-02T09:15:00.000Z',
    updatedAt: '2026-03-20T12:30:00.000Z',
    hasPendingChanges: false,
  },
  {
    id: 'tenant-carepoint',
    slug: 'carepoint',
    name: 'CarePoint',
    status: 'active',
    activeRuntimeConfigId: 'runtimecfg_carepoint_2026_05_02',
    branding: {
      appName: 'CarePoint',
      logoUrl: '/logos/carepoint.svg',
      primaryColor: '#f97316',
    },
    createdAt: '2026-03-03T13:10:00.000Z',
    updatedAt: '2026-05-02T11:00:00.000Z',
    hasPendingChanges: false,
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mergeBranding(
  current: BrandingConfig,
  next?: Partial<BrandingConfig>,
): BrandingConfig {
  if (!next) {
    return current;
  }

  return {
    ...current,
    ...next,
    gradients: {
      ...current.gradients,
      ...next.gradients,
    },
    metadata: {
      ...(current.metadata ?? {}),
      ...(next.metadata ?? {}),
    },
  };
}

function findRuntimeConfig(runtimeConfigId: string | null | undefined) {
  if (!runtimeConfigId) {
    return null;
  }

  return runtimeConfigs.find((runtimeConfig) => runtimeConfig.runtimeConfigId === runtimeConfigId) ?? null;
}

function getTenantRuntimeConfigs(
  tenantId: string,
  status?: RuntimeConfigStatus,
): TenantRuntimeConfigReference[] {
  return runtimeConfigs.filter((runtimeConfig) => {
    if (runtimeConfig.tenantId !== tenantId) {
      return false;
    }

    return status ? runtimeConfig.status === status : true;
  });
}

function computePublishingReadiness(
  tenant: StoredTenantRecord,
  activeRuntimeConfig: TenantRuntimeConfigReference | null,
): TenantPublishingReadiness {
  const blockingIssues: string[] = [];
  const warnings = [...getTenantBrandingWarnings(tenant.branding)];

  if (tenant.status === 'active' && !activeRuntimeConfig) {
    blockingIssues.push('Active tenants require an active published runtime config.');
  }

  if (activeRuntimeConfig && activeRuntimeConfig.status !== 'published') {
    blockingIssues.push('Only published runtime configs can be activated for runtime traffic.');
  }

  if (activeRuntimeConfig && activeRuntimeConfig.tenantId !== tenant.id) {
    blockingIssues.push('Active runtime config must belong to the same tenant.');
  }

  if (!activeRuntimeConfig && tenant.status === 'draft') {
    warnings.push('Draft tenants stay private until a published runtime config is activated.');
  }

  if (tenant.status === 'disabled') {
    warnings.push('Disabled tenants keep history but must not resolve in the runtime app.');
  }

  if (tenant.status === 'archived') {
    warnings.push('Archived tenants are historical only and should not be reactivated in place.');
  }

  if (tenant.hasPendingChanges) {
    warnings.push(
      'Tenant changes are ahead of the active runtime snapshot. Publish a new immutable runtime config before expecting runtime changes.',
    );
  }

  return {
    canActivate: blockingIssues.length === 0 && tenant.status !== 'archived',
    canPublish: tenant.status !== 'archived',
    hasPendingChanges: tenant.hasPendingChanges,
    blockingIssues,
    warnings,
  };
}

function hydrateTenant(record: StoredTenantRecord): Tenant {
  const activeRuntimeConfig = findRuntimeConfig(record.activeRuntimeConfigId);

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    status: record.status,
    activeRuntimeConfigId: record.activeRuntimeConfigId,
    branding: record.branding,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    activeRuntimeConfig,
    publishingReadiness: computePublishingReadiness(record, activeRuntimeConfig),
    brandingWarnings: validateBrandingConfig(record.branding).warnings,
  };
}

function ensureTenantName(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error('Tenant name is required.');
  }

  return trimmed;
}

function ensureUniqueSlug(slug: string, excludeTenantId?: string) {
  const exists = tenants.some(
    (tenant) => tenant.slug === slug && tenant.id !== excludeTenantId,
  );

  if (exists) {
    throw new Error(`Slug "${slug}" is already in use.`);
  }
}

function ensureValidRuntimeConfigLink(
  tenantId: string,
  runtimeConfigId: string | null,
): TenantRuntimeConfigReference | null {
  if (!runtimeConfigId) {
    return null;
  }

  const runtimeConfig = findRuntimeConfig(runtimeConfigId);
  if (!runtimeConfig) {
    throw new Error('Selected runtime config does not exist.');
  }

  if (runtimeConfig.tenantId !== tenantId) {
    throw new Error('Runtime config must belong to the same tenant.');
  }

  if (runtimeConfig.status !== 'published') {
    throw new Error('Only published runtime configs can be linked as active runtime configs.');
  }

  return runtimeConfig;
}

function assertArchivedTenantImmutable(
  current: StoredTenantRecord,
  data: UpdateTenantDto,
): void {
  if (current.status !== 'archived') {
    return;
  }

  const slugChanged = data.slug !== undefined && normalizeTenantSlugInput(data.slug) !== current.slug;
  const nameChanged = data.name !== undefined && data.name.trim() !== current.name;
  const statusChanged = data.status !== undefined && data.status !== 'archived';
  const runtimeConfigChanged =
    data.activeRuntimeConfigId !== undefined &&
    data.activeRuntimeConfigId !== current.activeRuntimeConfigId;
  const brandingChanged = data.branding !== undefined;

  if (slugChanged || nameChanged || statusChanged || runtimeConfigChanged || brandingChanged) {
    throw new Error('Archived tenants are protected and cannot be modified in place.');
  }
}

function assertStatusRequirements(
  status: TenantStatus,
  runtimeConfig: TenantRuntimeConfigReference | null,
) {
  if (status === 'active' && !runtimeConfig) {
    throw new Error('Active tenants must link to a published runtime config.');
  }
}

export async function getAllTenants(): Promise<Tenant[]> {
  await delay(120);
  return tenants.map(hydrateTenant);
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  await delay(100);
  const tenant = tenants.find((entry) => entry.id === id);
  return tenant ? hydrateTenant(tenant) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  await delay(100);
  const normalizedSlug = normalizeTenantSlugInput(slug);
  const tenant = tenants.find((entry) => entry.slug === normalizedSlug);
  return tenant ? hydrateTenant(tenant) : null;
}

export async function isSlugAvailable(
  slug: string,
  excludeTenantId?: string,
): Promise<boolean> {
  await delay(80);
  const normalizedSlug = normalizeTenantSlugInput(slug);
  return !tenants.some(
    (tenant) => tenant.slug === normalizedSlug && tenant.id !== excludeTenantId,
  );
}

export async function getRuntimeConfigOptionsForTenant(
  tenantId: string,
): Promise<RuntimeConfigOption[]> {
  await delay(120);

  return getTenantRuntimeConfigs(tenantId, 'published').map((runtimeConfig) => ({
    ...runtimeConfig,
    isActive: false,
    label: `${runtimeConfig.runtimeConfigId} • ${runtimeConfig.versionRefs.scannerVersionId} / ${runtimeConfig.versionRefs.attributeTemplateVersionId}`,
  }));
}

export async function createTenant(data: CreateTenantDto): Promise<Tenant> {
  await delay(180);

  const name = ensureTenantName(data.name);
  const slugValidation = validateTenantSlug(data.slug);
  if (slugValidation.errors.length > 0) {
    throw new Error(slugValidation.errors[0]);
  }

  ensureUniqueSlug(slugValidation.normalized);

  const brandingValidation = validateBrandingConfig(data.branding);
  if (brandingValidation.errors.length > 0) {
    throw new Error(brandingValidation.errors[0]);
  }

  if (data.activeRuntimeConfigId) {
    throw new Error('New tenants cannot point to an active runtime config before publish.');
  }

  const status = data.status ?? 'draft';
  assertStatusRequirements(status, null);

  const now = new Date().toISOString();
  const newTenant: StoredTenantRecord = {
    id: `tenant-${Date.now()}`,
    slug: slugValidation.normalized,
    name,
    status,
    activeRuntimeConfigId: null,
    branding: data.branding ?? {},
    createdAt: now,
    updatedAt: now,
    hasPendingChanges: true,
  };

  tenants = [...tenants, newTenant];
  return hydrateTenant(newTenant);
}

export async function updateTenant(
  id: string,
  data: UpdateTenantDto,
): Promise<Tenant> {
  await delay(180);

  const index = tenants.findIndex((tenant) => tenant.id === id);
  if (index === -1) {
    throw new Error('Tenant not found.');
  }

  const current = tenants[index];
  assertArchivedTenantImmutable(current, data);

  const nextName = data.name !== undefined ? ensureTenantName(data.name) : current.name;
  const nextSlug =
    data.slug !== undefined ? validateTenantSlug(data.slug).normalized : current.slug;

  if (data.slug !== undefined) {
    const slugValidation = validateTenantSlug(data.slug);
    if (slugValidation.errors.length > 0) {
      throw new Error(slugValidation.errors[0]);
    }

    if (slugValidation.normalized !== current.slug && isTenantSlugLocked(current)) {
      throw new Error(
        'Slug becomes immutable after the tenant leaves draft or links to a published runtime config.',
      );
    }

    ensureUniqueSlug(slugValidation.normalized, id);
  }

  const mergedBranding = mergeBranding(current.branding, data.branding);
  const brandingValidation = validateBrandingConfig(mergedBranding);
  if (brandingValidation.errors.length > 0) {
    throw new Error(brandingValidation.errors[0]);
  }

  const nextRuntimeConfig =
    data.activeRuntimeConfigId !== undefined
      ? ensureValidRuntimeConfigLink(id, data.activeRuntimeConfigId)
      : ensureValidRuntimeConfigLink(id, current.activeRuntimeConfigId);

  const nextStatus = data.status ?? current.status;
  assertStatusRequirements(nextStatus, nextRuntimeConfig);

  const draftContractChanged =
    data.name !== undefined || data.slug !== undefined || data.branding !== undefined;

  const updated: StoredTenantRecord = {
    ...current,
    name: nextName,
    slug: nextSlug,
    status: nextStatus,
    activeRuntimeConfigId:
      data.activeRuntimeConfigId !== undefined
        ? data.activeRuntimeConfigId
        : current.activeRuntimeConfigId,
    branding: mergedBranding,
    updatedAt: new Date().toISOString(),
    hasPendingChanges:
      data.activeRuntimeConfigId !== undefined
        ? draftContractChanged
        : current.hasPendingChanges || draftContractChanged,
  };

  tenants = tenants.map((tenant, tenantIndex) =>
    tenantIndex === index ? updated : tenant,
  );

  return hydrateTenant(updated);
}

export async function updateTenantBranding(
  id: string,
  branding: Partial<BrandingConfig>,
): Promise<Tenant> {
  return updateTenant(id, { branding });
}

export async function deleteTenant(id: string): Promise<void> {
  await delay(140);

  const tenant = tenants.find((entry) => entry.id === id);
  if (!tenant) {
    throw new Error('Tenant not found.');
  }

  if (tenant.status !== 'draft' || tenant.activeRuntimeConfigId) {
    throw new Error(
      'Only draft tenants without an active runtime config can be deleted safely.',
    );
  }

  tenants = tenants.filter((entry) => entry.id !== id);
}

export async function getTenantStats(): Promise<{
  total: number;
  draft: number;
  active: number;
  disabled: number;
  archived: number;
  activeRuntimeConfigs: number;
  byBranding: Record<string, number>;
}> {
  await delay(100);

  const hydratedTenants = tenants.map(hydrateTenant);

  return {
    total: hydratedTenants.length,
    draft: hydratedTenants.filter((tenant) => tenant.status === 'draft').length,
    active: hydratedTenants.filter((tenant) => tenant.status === 'active').length,
    disabled: hydratedTenants.filter((tenant) => tenant.status === 'disabled').length,
    archived: hydratedTenants.filter((tenant) => tenant.status === 'archived').length,
    activeRuntimeConfigs: hydratedTenants.filter((tenant) => tenant.activeRuntimeConfigId).length,
    byBranding: {
      custom: hydratedTenants.filter(
        (tenant) => JSON.stringify(resolveBrandingConfig(tenant.branding)) !== JSON.stringify(resolveBrandingConfig({})),
      ).length,
      default: hydratedTenants.filter(
        (tenant) => JSON.stringify(resolveBrandingConfig(tenant.branding)) === JSON.stringify(resolveBrandingConfig({})),
      ).length,
      warnings: hydratedTenants.filter(
        (tenant) => validateBrandingConfig(tenant.branding).warnings.length > 0,
      ).length,
    },
  };
}
