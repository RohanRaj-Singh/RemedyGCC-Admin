import 'server-only';

import { getAllTemplates, getTemplateById } from '@/modules/attribute-template/service';
import type { AttributeTemplate } from '@/modules/attribute-template/types';
import {
  DEFAULT_RUNTIME_SETTINGS,
  generateRuntimeConfig,
  getRuntimeConfigFingerprint,
} from '@/modules/publishing/engine';
import { getScannerById, getScanners } from '@/modules/scanner/service';
import type { Scanner, ScannerDetail, ScannerVersion } from '@/modules/scanner/types';
import { resolveBrandingConfig, validateBrandingConfig } from '@/types/branding';
import { normalizeTenantContentConfig } from '@/types/content';
import type {
  RuntimeAttributeTemplate,
  RuntimeScannerVersion,
  RuntimeTenantSummary,
  TenantRuntimeConfigSnapshot,
} from '@/types/runtime-config';
import {
  activateRuntimeConfigForTenant,
  deleteAttributeTemplateVersionsForTenant,
  deleteRawResponsesForTenant,
  deleteRuntimeConfigsForTenant,
  deleteScannerVersionsForTenant,
  deleteTenantDocument,
  ensureTenantModuleIndexes,
  getTenantDetailData,
  getTenantDocumentBySlug,
  getTenantListData,
  insertTenantDocument,
  publishTenantRuntimeDocuments,
  updateTenantDocument,
  type AttributeTemplateVersionDocument,
  type RuntimeConfigDocument,
  type ScannerVersionDocument,
  type TenantDetailData,
  type TenantDocument,
} from '@/server/tenant/repository';
import type {
  CreateTenantDto,
  PublishTenantRuntimeOptions,
  RuntimeConfigOption,
  Tenant,
  TenantDraftSetupReference,
  TenantPublishResult,
  TenantPublishingPreview,
  TenantPublishingReadiness,
  TenantRuntimeAttributeTemplateSummary,
  TenantRuntimeConfigReference,
  TenantRuntimeScannerSummary,
  TenantStatus,
  UpdateTenantDto,
} from './types';
import {
  createDeterministicId,
  createFingerprint,
  getTenantBrandingWarnings,
  isTenantIdentityLocked,
  normalizeTenantSlugInput,
  normalizeTenantSubdomainInput,
  validateTenantSlug,
  validateTenantSubdomain,
} from './utils';
import { deleteTenantAccessForTenant } from '@/modules/tenant-auth/services/auth-service';
import {
  ensureTenantAssetDirectory,
  getTenantAssetPaths,
  rebaseTenantBrandingAssetPaths,
  resolveTenantAssetPath,
  syncTenantAssetDirectory,
} from '@/lib/uploads/tenant-assets';
import { rm } from 'node:fs/promises';

const CALCULATION_VERSION_ID = 'calc_demo_placeholder_v1';

interface ResolvedPublishingSource {
  scannerDetail: ScannerDetail | null;
  sourceVersion: ScannerVersion | null;
  sourceTemplate: AttributeTemplate | null;
  templateMismatch: boolean;
}

interface DraftSetupCatalog {
  scannerMap: Map<string, Scanner>;
  templateMap: Map<string, AttributeTemplate>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Self-heal stale logo/background URLs before publishing.
 *
 * If the runtime config references an asset file that no longer exists on
 * disk (e.g. the logo was re-uploaded under a different extension, or wiped
 * before a new one was saved), fall back to whatever file is actually
 * present, or to the bundled default asset. Without this, the published
 * runtime config can carry a 404-bound URL that the tenantapp rewrite
 * then surfaces to end users.
 */
async function resolveBrandingAssetPaths(
  tenantSlug: string,
  branding: Tenant['branding'],
): Promise<Tenant['branding']> {
  const base = clone(branding ?? {});
  const [resolvedLogo, resolvedBackground] = await Promise.all([
    resolveTenantAssetPath(
      tenantSlug,
      'logo',
      base.logo ?? base.logoUrl,
      base.logo ?? base.logoUrl ?? '/default/logo.png',
    ),
    resolveTenantAssetPath(
      tenantSlug,
      'background',
      base.backgroundImage,
      base.backgroundImage ?? '/default/background.png',
    ),
  ]);
  if (resolvedLogo) {
    base.logo = resolvedLogo;
    base.logoUrl = resolvedLogo;
  }
  if (resolvedBackground) {
    base.backgroundImage = resolvedBackground;
  }
  return base;
}

function createTenantSummary(document: TenantDocument): RuntimeTenantSummary {
  return {
    id: document.tenantId,
    name: document.name,
    nameTranslations: {
      en: document.name,
      ar: document.nameAr?.trim() ?? '',
    },
    slug: document.slug,
    status: document.status,
  };
}

function normalizeTenantDocument(document: TenantDocument): TenantDocument {
  return {
    ...document,
    nameAr: document.nameAr?.trim() || null,
    subdomain: document.subdomain || document.slug,
    branding: document.branding ?? {},
    content: normalizeTenantContentConfig(document.content),
    draftScannerId: document.draftScannerId ?? null,
    draftAttributeTemplateId: document.draftAttributeTemplateId ?? null,
    activeRuntimeConfigId: document.activeRuntimeConfigId ?? null,
    activeRuntimeConfigPublishedAt: document.activeRuntimeConfigPublishedAt ?? null,
    brandingVersionId: document.brandingVersionId ?? null,
    archivedAt: document.archivedAt ?? null,
  };
}

function getRuntimeConfigStatus(
  tenant: TenantDocument,
  runtimeConfig: RuntimeConfigDocument,
): RuntimeConfigOption['status'] {
  if (tenant.activeRuntimeConfigId === runtimeConfig.runtimeConfigId) {
    if (tenant.status === 'disabled') {
      return 'disabled';
    }

    if (tenant.status === 'archived') {
      return 'archived';
    }

    return 'active';
  }

  return 'published';
}

function buildScannerSummary(
  scannerVersion: RuntimeScannerVersion,
): TenantRuntimeScannerSummary {
  const subdomainCount = scannerVersion.categories.reduce(
    (total, category) => total + category.subdomains.length,
    0,
  );
  const questionCount = scannerVersion.categories.reduce(
    (total, category) =>
      total
      + category.subdomains.reduce(
        (subdomainTotal, subdomain) => subdomainTotal + subdomain.questions.length,
        0,
      ),
    0,
  );

  return {
    scannerVersionId: scannerVersion.id,
    version: scannerVersion.version,
    categoryCount: scannerVersion.categories.length,
    subdomainCount,
    questionCount,
  };
}

function buildAttributeTemplateSummary(
  attributeTemplate: RuntimeAttributeTemplate,
  versionId: string,
): TenantRuntimeAttributeTemplateSummary {
  return {
    attributeTemplateVersionId: versionId,
    streamCount: attributeTemplate.streams.length,
    locationCount: attributeTemplate.locations.length,
    functionCount: attributeTemplate.functions.length,
    departmentCount: attributeTemplate.departments.length,
  };
}

function toRuntimeConfigReference(
  tenant: TenantDocument,
  runtimeConfig: RuntimeConfigDocument,
  submissionCount: number,
): TenantRuntimeConfigReference {
  return {
    runtimeConfigId: runtimeConfig.runtimeConfigId,
    tenantId: runtimeConfig.tenantId,
    tenantSlug: runtimeConfig.tenantSlug,
    tenantSubdomain: runtimeConfig.tenantSubdomain || runtimeConfig.tenantSlug,
    status: getRuntimeConfigStatus(tenant, runtimeConfig),
    publishedAt: runtimeConfig.publishedAt,
    activatedAt: runtimeConfig.activatedAt ?? null,
    versionRefs: clone(runtimeConfig.versionRefs),
    submissionCount,
    scannerSummary: buildScannerSummary(runtimeConfig.scannerVersion),
    attributeTemplateSummary: buildAttributeTemplateSummary(
      runtimeConfig.attributeTemplate,
      runtimeConfig.versionRefs.attributeTemplateVersionId,
    ),
  };
}

function buildRuntimeConfigLabel(runtimeConfig: TenantRuntimeConfigReference): string {
  return `${runtimeConfig.runtimeConfigId} - ${runtimeConfig.scannerSummary.version} / ${runtimeConfig.attributeTemplateSummary.streamCount} streams`;
}

function getTenantRuntimeFingerprint(runtimeConfig: RuntimeConfigDocument): string {
  return runtimeConfig.fingerprint || getRuntimeConfigFingerprint(runtimeConfig);
}

function createTenantId(slug: string): string {
  return `tenant-${slug}-${Date.now().toString(36)}`;
}

function createRuntimeConfigId(
  subdomain: string,
  runtimeConfigs: RuntimeConfigDocument[],
): string {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `runtimecfg_${subdomain.replace(/-/g, '_')}_${dateKey}_`;
  const sequence = runtimeConfigs.filter((runtimeConfig) =>
    runtimeConfig.runtimeConfigId.startsWith(prefix)).length + 1;

  return `${prefix}${String(sequence).padStart(3, '0')}`;
}

function createVersionResolver(
  detailData: TenantDetailData,
  fallbackRuntimeConfigs: RuntimeConfigDocument[],
) {
  const scannerVersionMatches = new Map<string, { id: string; version: string }>();
  detailData.scannerVersions.forEach((version) => {
    if (version.sourceFingerprint) {
      scannerVersionMatches.set(version.sourceFingerprint, {
        id: version.scannerVersionId,
        version: version.version,
      });
    }
  });

  const attributeTemplateMatches = new Map<string, { id: string; version: string }>();
  detailData.attributeTemplateVersions.forEach((version) => {
    if (version.fingerprint) {
      attributeTemplateMatches.set(version.fingerprint, {
        id: version.attributeTemplateVersionId,
        version: version.version,
      });
    }
  });

  const brandingMatches = new Map<string, { id: string; version: string }>();
  fallbackRuntimeConfigs.forEach((runtimeConfig) => {
    const brandingFingerprint =
      runtimeConfig.brandingFingerprint || createFingerprint(runtimeConfig.branding ?? {});

    if (!brandingMatches.has(brandingFingerprint)) {
      brandingMatches.set(brandingFingerprint, {
        id: runtimeConfig.versionRefs.brandingVersionId,
        version: `v${brandingMatches.size + 1}`,
      });
    }
  });

  return ({
    scannerFingerprint,
    attributeTemplateFingerprint,
    brandingFingerprint,
    calculationVersionId,
  }: {
    scannerFingerprint: string;
    attributeTemplateFingerprint: string;
    brandingFingerprint: string;
    sourceScannerId: string;
    sourceScannerVersionId: string;
    sourceAttributeTemplateId: string;
    calculationVersionId: string;
  }) => {
    const existingScannerVersion = scannerVersionMatches.get(scannerFingerprint);
    const existingAttributeTemplateVersion =
      attributeTemplateMatches.get(attributeTemplateFingerprint);
    const existingBrandingVersion = brandingMatches.get(brandingFingerprint);

    return {
      versionRefs: {
        scannerVersionId:
          existingScannerVersion?.id
          ?? createDeterministicId('scanver', scannerFingerprint),
        attributeTemplateVersionId:
          existingAttributeTemplateVersion?.id
          ?? createDeterministicId('attrtpl', attributeTemplateFingerprint),
        calculationVersionId,
        brandingVersionId:
          existingBrandingVersion?.id
          ?? createDeterministicId('brandver', brandingFingerprint),
      },
      scannerVersion:
        existingScannerVersion?.version
        ?? `v${detailData.scannerVersions.length + 1}`,
      attributeTemplateVersion:
        existingAttributeTemplateVersion?.version
        ?? `v${detailData.attributeTemplateVersions.length + 1}`,
      brandingVersion:
        existingBrandingVersion?.version
        ?? `v${brandingMatches.size + 1}`,
      reused: {
        scanner: Boolean(existingScannerVersion),
        attributeTemplate: Boolean(existingAttributeTemplateVersion),
        branding: Boolean(existingBrandingVersion),
      },
    };
  };
}

function createScannerSourceFingerprint(
  scannerDetail: ScannerDetail,
  sourceVersion: ScannerVersion,
): string {
  return createFingerprint({
    sourceScannerId: scannerDetail.id,
    sourceScannerVersionId: sourceVersion.id,
    language: DEFAULT_RUNTIME_SETTINGS.language,
    categories: sourceVersion.categories,
    followUpTriggers: sourceVersion.followUpTriggers,
  });
}

async function getDraftSetupCatalog(): Promise<DraftSetupCatalog> {
  const [scanners, templates] = await Promise.all([
    getScanners(),
    getAllTemplates(),
  ]);

  return {
    scannerMap: new Map(scanners.map((scanner) => [scanner.id, scanner])),
    templateMap: new Map(templates.map((template) => [template.id, template])),
  };
}

async function resolvePublishingSource(
  tenant: TenantDocument,
): Promise<ResolvedPublishingSource> {
  const scannerDetail = tenant.draftScannerId
    ? await getScannerById(tenant.draftScannerId)
    : null;
  const sourceVersion =
    scannerDetail?.status === 'published' && scannerDetail.publishedVersion
      ? scannerDetail.publishedVersion
      : null;

  const sourceTemplate = tenant.draftAttributeTemplateId
    ? await getTemplateById(tenant.draftAttributeTemplateId)
    : null;

  return {
    scannerDetail,
    sourceVersion,
    sourceTemplate,
    templateMismatch: false,
  };
}

function assertTenantName(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error('Tenant name is required.');
  }

  return trimmed;
}

function normalizeOptionalTenantName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}

async function assertPublishedTenantScanner(
  scannerId: string | null | undefined,
): Promise<void> {
  if (!scannerId) {
    return;
  }

  const scannerDetail = await getScannerById(scannerId);
  if (!scannerDetail) {
    throw new Error('Selected scanner was not found.');
  }

  if (scannerDetail.status !== 'published' || !scannerDetail.publishedVersion) {
    throw new Error('Only published scanners can be assigned to a tenant.');
  }
}

function assertUniqueIdentifier(
  tenants: TenantDocument[],
  field: 'slug' | 'subdomain',
  value: string,
  excludeTenantId?: string,
): void {
  const duplicate = tenants.find(
    (tenant) => tenant[field] === value && tenant.tenantId !== excludeTenantId,
  );

  if (duplicate) {
    throw new Error(
      field === 'slug'
        ? `Slug "${value}" is already in use.`
        : `Subdomain "${value}" is already in use.`,
    );
  }
}

function assertEditableTenant(current: TenantDocument): void {
  if (current.status === 'archived') {
    throw new Error('Archived tenants are protected and cannot be modified.');
  }
}

function assertSafeStatus(
  current: TenantDocument,
  nextStatus: TenantStatus,
  hasActiveRuntimeConfig: boolean,
): void {
  if (nextStatus === 'active' && !hasActiveRuntimeConfig) {
    throw new Error('Publish the survey before making this tenant live.');
  }

  if (nextStatus === 'archived' && current.status === 'active') {
    throw new Error('Disable the tenant before archiving it.');
  }
}

function assertSafeIdentityChange(
  current: TenantDocument,
  nextSlug: string,
  nextSubdomain: string,
  submissionCount: number,
  runtimeConfigCount: number,
): void {
  const slugChanged = current.slug !== nextSlug;
  const subdomainChanged = (current.subdomain || current.slug) !== nextSubdomain;

  if (!slugChanged && !subdomainChanged) {
    return;
  }

  if (
    isTenantIdentityLocked({
      status: current.status,
      activeRuntimeConfigId: current.activeRuntimeConfigId ?? null,
      submissionCount,
    })
    || runtimeConfigCount > 0
  ) {
    throw new Error(
      'Slug and subdomain are locked after a tenant leaves draft, publishes a live survey, or receives submissions.',
    );
  }
}

function findExistingRuntimeMatch(
  runtimeConfigs: RuntimeConfigDocument[],
  previewRuntimeConfig: TenantRuntimeConfigSnapshot | null | undefined,
): RuntimeConfigDocument | null {
  if (!previewRuntimeConfig) {
    return null;
  }

  const previewFingerprint = getRuntimeConfigFingerprint(previewRuntimeConfig);
  return runtimeConfigs.find(
    (runtimeConfig) => getTenantRuntimeFingerprint(runtimeConfig) === previewFingerprint,
  ) ?? null;
}

async function buildPublishingPreview(
  tenant: TenantDocument,
  detailData: TenantDetailData,
): Promise<TenantPublishingPreview> {
  const issues: TenantPublishingPreview['issues'] = [];
  const warnings: string[] = [];
  const resolvedSource = await resolvePublishingSource(tenant);

  if (!tenant.draftScannerId) {
    issues.push({
      code: 'TENANT_SCANNER_REQUIRED',
      level: 'tenant',
      path: 'draftScannerId',
      message: 'Choose a scanner before publishing this survey.',
      blocking: true,
    });
  }

  if (tenant.draftScannerId && !resolvedSource.scannerDetail) {
    issues.push({
      code: 'TENANT_SCANNER_MISSING',
      level: 'tenant',
      path: 'draftScannerId',
      message: 'The selected scanner no longer exists. Choose a published scanner before publishing this survey.',
      blocking: true,
    });
  }

  if (tenant.draftScannerId && resolvedSource.scannerDetail && !resolvedSource.sourceVersion) {
    issues.push({
      code: 'TENANT_SCANNER_NOT_PUBLISHED',
      level: 'tenant',
      path: 'draftScannerId',
      message: 'Only published scanners can be assigned to a tenant. Select a published scanner before publishing this survey.',
      blocking: true,
    });
  }

  if (!tenant.draftAttributeTemplateId) {
    issues.push({
      code: 'TENANT_ATTRIBUTE_TEMPLATE_REQUIRED',
      level: 'tenant',
      path: 'draftAttributeTemplateId',
      message: 'Choose an attribute template before publishing this survey.',
      blocking: true,
    });
  }

  if (resolvedSource.templateMismatch) {
    issues.push({
      code: 'TENANT_SETUP_TEMPLATE_MISMATCH',
      level: 'tenant',
      path: 'draftAttributeTemplateId',
      message:
        'The selected scanner expects a different attribute template. Choose the matching template or update the scanner before publishing.',
      blocking: true,
    });
  }

  const runtimeConfigId = createRuntimeConfigId(
    tenant.subdomain || tenant.slug,
    detailData.runtimeConfigs,
  );
  const publishedAt = new Date().toISOString();

  const generated = generateRuntimeConfig({
    tenant: createTenantSummary(tenant),
    branding: await resolveBrandingAssetPaths(
      tenant.slug,
      tenant.branding ?? {},
    ),
    content: tenant.content ?? {},
    runtimeSettings: clone(DEFAULT_RUNTIME_SETTINGS),
    sourceScanner:
      resolvedSource.scannerDetail && resolvedSource.sourceVersion
        ? {
          scannerId: resolvedSource.scannerDetail.id,
          name: resolvedSource.scannerDetail.name,
          description: resolvedSource.scannerDetail.description,
          version: resolvedSource.sourceVersion,
        }
        : null,
    sourceAttributeTemplate: resolvedSource.sourceTemplate,
    calculationVersionId: CALCULATION_VERSION_ID,
    runtimeConfigId,
    publishedAt,
    activatedAt: null,
    isActive: false,
    resolveVersionRefs: createVersionResolver(detailData, detailData.runtimeConfigs),
  });

  issues.push(...generated.issues);
  warnings.push(...generated.warnings);
  warnings.push(...getTenantBrandingWarnings(tenant.branding ?? {}));

  const existingMatch = generated.runtimeConfig
    ? findExistingRuntimeMatch(detailData.runtimeConfigs, generated.runtimeConfig)
    : null;

  if (existingMatch) {
    issues.push({
      code: 'RUNTIME_CONFIGURATION_ALREADY_EXISTS',
      level: 'runtime-config',
      path: 'runtimeConfigId',
      message:
        existingMatch.runtimeConfigId === tenant.activeRuntimeConfigId
          ? 'These settings already match the current live survey.'
          : 'These settings already match a previously published survey. Make that survey live instead of publishing again.',
      blocking: true,
    });
  }

  return {
    status: 'draft',
    isReady: issues.every((issue) => !issue.blocking),
    issues,
    warnings: Array.from(new Set(warnings)),
    runtimeConfig: generated.runtimeConfig,
    existingMatchRuntimeConfigId: existingMatch?.runtimeConfigId ?? null,
  };
}

function computePublishingReadiness(
  tenant: TenantDocument,
  activeRuntimeConfig: TenantRuntimeConfigReference | null,
  activeRuntimeFingerprint: string | null,
  preview: TenantPublishingPreview,
): TenantPublishingReadiness {
  const blockingIssues = preview.issues
    .filter((issue) => issue.blocking)
    .map((issue) => issue.message);
  const warnings = [...preview.warnings];

  if (!tenant.draftScannerId || !tenant.draftAttributeTemplateId) {
    warnings.push(
      'This tenant is not live yet. Choose a scanner and attribute template, then publish the survey.',
    );
  }

  if (tenant.status === 'disabled') {
    warnings.push('Survey access is currently turned off. Reactivate it when you are ready to reopen the survey.');
  }

  if (tenant.status === 'archived') {
    warnings.push('Archived tenants are kept for history and cannot publish new surveys.');
  }

  if (tenant.status === 'active' && !activeRuntimeConfig) {
    blockingIssues.push('A live tenant must always keep one published survey linked.');
  }

  const previewFingerprint = preview.runtimeConfig
    ? getRuntimeConfigFingerprint(preview.runtimeConfig)
    : null;

  return {
    canActivate:
      tenant.status !== 'archived'
      && Boolean(preview.existingMatchRuntimeConfigId || activeRuntimeConfig),
    canPublish: tenant.status !== 'archived' && preview.isReady,
    hasPendingChanges:
      previewFingerprint !== null
        ? activeRuntimeFingerprint !== previewFingerprint
        : Boolean(tenant.draftScannerId || tenant.draftAttributeTemplateId),
    blockingIssues: Array.from(new Set(blockingIssues)),
    warnings: Array.from(new Set(warnings)),
  };
}

async function hydrateTenant(
  document: TenantDocument,
  detailData: TenantDetailData,
  catalog: DraftSetupCatalog,
  includePreview = false,
): Promise<Tenant> {
  const normalized = normalizeTenantDocument(document);
  const runtimeConfigs = detailData.runtimeConfigs
    .filter((runtimeConfig) => runtimeConfig.tenantId === normalized.tenantId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

  const activeRuntimeConfigDocument = runtimeConfigs.find(
    (runtimeConfig) => runtimeConfig.runtimeConfigId === normalized.activeRuntimeConfigId,
  ) ?? null;

  const activeRuntimeConfig = activeRuntimeConfigDocument
    ? toRuntimeConfigReference(
      normalized,
      activeRuntimeConfigDocument,
      detailData.runtimeSubmissionCounts[activeRuntimeConfigDocument.runtimeConfigId] ?? 0,
    )
    : null;
  const activeRuntimeFingerprint = activeRuntimeConfigDocument
    ? getTenantRuntimeFingerprint(activeRuntimeConfigDocument)
    : null;

  const preview = await buildPublishingPreview(normalized, detailData);
  const draftScanner = normalized.draftScannerId
    ? catalog.scannerMap.get(normalized.draftScannerId)
    : null;
  const draftAttributeTemplate = normalized.draftAttributeTemplateId
    ? catalog.templateMap.get(normalized.draftAttributeTemplateId)
    : null;

  return {
    id: normalized.tenantId,
    slug: normalized.slug,
    subdomain: normalized.subdomain || normalized.slug,
    name: normalized.name,
    nameAr: normalized.nameAr ?? null,
    status: normalized.status,
    draftScannerId: normalized.draftScannerId ?? null,
    draftAttributeTemplateId: normalized.draftAttributeTemplateId ?? null,
    activeRuntimeConfigId: normalized.activeRuntimeConfigId ?? null,
    branding: clone(normalized.branding ?? {}),
    content: clone(normalized.content ?? {}),
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    archivedAt: normalized.archivedAt ?? null,
    submissionCount: detailData.tenantSubmissionCounts[normalized.tenantId] ?? 0,
    runtimeConfigCount: runtimeConfigs.length,
    draftScanner: draftScanner
      ? {
        id: draftScanner.id,
        label: draftScanner.name.en || draftScanner.id,
        description: draftScanner.description?.en,
      } satisfies TenantDraftSetupReference
      : null,
    draftAttributeTemplate: draftAttributeTemplate
      ? {
        id: draftAttributeTemplate.id,
        label: draftAttributeTemplate.name,
        description: draftAttributeTemplate.description,
      } satisfies TenantDraftSetupReference
      : null,
    activeRuntimeConfig,
    publishingReadiness: computePublishingReadiness(
      normalized,
      activeRuntimeConfig,
      activeRuntimeFingerprint,
      preview,
    ),
    brandingWarnings: validateBrandingConfig(normalized.branding ?? {}).warnings,
    publishingPreview: includePreview ? preview : undefined,
  };
}

async function loadTenantById(
  tenantId: string,
  includePreview = false,
): Promise<Tenant | null> {
  await ensureTenantModuleIndexes();
  const [detailData, catalog] = await Promise.all([
    getTenantDetailData(tenantId),
    getDraftSetupCatalog(),
  ]);

  if (!detailData.tenant) {
    return null;
  }

  return hydrateTenant(detailData.tenant, detailData, catalog, includePreview);
}

export async function getAllTenants(): Promise<Tenant[]> {
  await ensureTenantModuleIndexes();
  const [listData, catalog] = await Promise.all([
    getTenantListData(),
    getDraftSetupCatalog(),
  ]);

  return Promise.all(
    listData.tenants.map((tenant) =>
      hydrateTenant(
        tenant,
        {
          ...listData,
          tenant,
          runtimeConfigs: listData.runtimeConfigs.filter(
            (runtimeConfig) => runtimeConfig.tenantId === tenant.tenantId,
          ),
          scannerVersions: [],
          attributeTemplateVersions: [],
        },
        catalog,
        false,
      )),
  );
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  return loadTenantById(id, true);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  await ensureTenantModuleIndexes();
  const normalizedSlug = normalizeTenantSlugInput(slug);
  const tenant = await getTenantDocumentBySlug(normalizedSlug);
  if (!tenant) {
    return null;
  }

  return loadTenantById(tenant.tenantId, true);
}

export async function getTenantPublishingPreview(
  tenantId: string,
): Promise<TenantPublishingPreview> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  return buildPublishingPreview(detailData.tenant, detailData);
}

export async function getRuntimeConfigOptionsForTenant(
  tenantId: string,
): Promise<RuntimeConfigOption[]> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const normalizedTenant = normalizeTenantDocument(detailData.tenant);
  return detailData.runtimeConfigs
    .filter((runtimeConfig) => runtimeConfig.tenantId === tenantId)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .map((runtimeConfig) => {
      const reference = toRuntimeConfigReference(
        normalizedTenant,
        runtimeConfig,
        detailData.runtimeSubmissionCounts[runtimeConfig.runtimeConfigId] ?? 0,
      );

      return {
        ...reference,
        isActive: normalizedTenant.activeRuntimeConfigId === runtimeConfig.runtimeConfigId,
        label: buildRuntimeConfigLabel(reference),
      };
    });
}

export async function isSlugAvailable(
  slug: string,
  excludeTenantId?: string,
): Promise<boolean> {
  await ensureTenantModuleIndexes();
  const normalized = normalizeTenantSlugInput(slug);
  const listData = await getTenantListData();

  return !listData.tenants.some(
    (tenant) => tenant.slug === normalized && tenant.tenantId !== excludeTenantId,
  );
}

export async function checkSubdomainAvailable(subdomain: string): Promise<boolean> {
  await ensureTenantModuleIndexes();
  const normalized = subdomain.toLowerCase().trim();
  const listData = await getTenantListData();

  return !listData.tenants.some(
    (tenant) => tenant.subdomain === normalized,
  );
}

export async function createTenant(data: CreateTenantDto): Promise<Tenant> {
  await ensureTenantModuleIndexes();
  const listData = await getTenantListData();

  const name = assertTenantName(data.name);
  const nameAr = normalizeOptionalTenantName(data.nameAr);
  const slugValidation = validateTenantSlug(data.slug);
  if (slugValidation.errors.length > 0) {
    throw new Error(slugValidation.errors[0]);
  }

  const subdomainValidation = validateTenantSubdomain(data.subdomain);
  if (subdomainValidation.errors.length > 0) {
    throw new Error(subdomainValidation.errors[0]);
  }

  assertUniqueIdentifier(listData.tenants, 'slug', slugValidation.normalized);
  assertUniqueIdentifier(listData.tenants, 'subdomain', subdomainValidation.normalized);

  const brandingValidation = validateBrandingConfig(data.branding ?? {});
  if (brandingValidation.errors.length > 0) {
    throw new Error(brandingValidation.errors[0]);
  }

  const status = data.status ?? 'draft';
  if (status === 'active') {
    throw new Error('New tenants start in Draft Setup. Publish the survey before making it live.');
  }

  await assertPublishedTenantScanner(data.draftScannerId ?? null);

  const now = new Date().toISOString();
  const normalizedBranding = {
    ...(data.branding ?? {}),
    logo: data.branding?.logo ?? data.branding?.logoUrl,
    logoUrl: data.branding?.logo ?? data.branding?.logoUrl,
  };
  const normalizedContent = normalizeTenantContentConfig(data.content);
  const document: TenantDocument = {
    tenantId: createTenantId(slugValidation.normalized),
    name,
    nameAr,
    slug: slugValidation.normalized,
    subdomain: subdomainValidation.normalized,
    status,
    branding: normalizedBranding,
    content: normalizedContent,
    activeRuntimeConfigId: null,
    activeRuntimeConfigPublishedAt: null,
    brandingVersionId: null,
    draftScannerId: data.draftScannerId ?? null,
    draftAttributeTemplateId: data.draftAttributeTemplateId ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };

  await ensureTenantAssetDirectory(slugValidation.normalized);
  await insertTenantDocument(document);
  const createdTenant = await getTenantById(document.tenantId);
  if (!createdTenant) {
    throw new Error('Tenant was created but could not be loaded.');
  }

  return createdTenant;
}

export async function updateTenant(
  id: string,
  data: UpdateTenantDto,
): Promise<Tenant> {
  await ensureTenantModuleIndexes();
  const [detailData, listData] = await Promise.all([
    getTenantDetailData(id),
    getTenantListData(),
  ]);

  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);
  assertEditableTenant(current);

  const nextName = data.name !== undefined ? assertTenantName(data.name) : current.name;
  const nextNameAr = data.nameAr !== undefined
    ? normalizeOptionalTenantName(data.nameAr)
    : current.nameAr ?? null;
  const nextSlug = data.slug !== undefined
    ? validateTenantSlug(data.slug).normalized
    : current.slug;
  const nextSubdomain = data.subdomain !== undefined
    ? validateTenantSubdomain(data.subdomain).normalized
    : current.subdomain || current.slug;

  if (data.slug !== undefined) {
    const slugValidation = validateTenantSlug(data.slug);
    if (slugValidation.errors.length > 0) {
      throw new Error(slugValidation.errors[0]);
    }

    assertUniqueIdentifier(listData.tenants, 'slug', slugValidation.normalized, current.tenantId);
  }

  if (data.subdomain !== undefined) {
    const subdomainValidation = validateTenantSubdomain(data.subdomain);
    if (subdomainValidation.errors.length > 0) {
      throw new Error(subdomainValidation.errors[0]);
    }

    assertUniqueIdentifier(
      listData.tenants,
      'subdomain',
      subdomainValidation.normalized,
      current.tenantId,
    );
  }

  assertSafeIdentityChange(
    current,
    nextSlug,
    nextSubdomain,
    detailData.tenantSubmissionCounts[current.tenantId] ?? 0,
    detailData.runtimeConfigs.length,
  );

  const mergedBranding = {
    ...current.branding,
    ...data.branding,
    logo:
      data.branding?.logo
      ?? data.branding?.logoUrl
      ?? current.branding?.logo
      ?? current.branding?.logoUrl,
    logoUrl:
      data.branding?.logo
      ?? data.branding?.logoUrl
      ?? current.branding?.logo
      ?? current.branding?.logoUrl,
    gradient: {
      ...(current.branding?.gradient ?? {}),
      ...(data.branding?.gradient ?? {}),
    },
    metadata: {
      ...(current.branding?.metadata ?? {}),
      ...(data.branding?.metadata ?? {}),
    },
  };
  const mergedContent = normalizeTenantContentConfig({
    ...current.content,
    ...data.content,
    pages: {
      ...(current.content?.pages ?? {}),
      ...(data.content?.pages ?? {}),
      about: {
        ...(current.content?.pages?.about ?? {}),
        ...(data.content?.pages?.about ?? {}),
      },
    },
  });

  const brandingValidation = validateBrandingConfig(mergedBranding);
  if (brandingValidation.errors.length > 0) {
    throw new Error(brandingValidation.errors[0]);
  }

  const nextDraftScannerId =
    data.draftScannerId !== undefined ? data.draftScannerId : current.draftScannerId;
  await assertPublishedTenantScanner(nextDraftScannerId);

  const nextStatus = data.status ?? current.status;
  assertSafeStatus(current, nextStatus, Boolean(current.activeRuntimeConfigId));
  const normalizedBranding = rebaseTenantBrandingAssetPaths(
    mergedBranding,
    current.slug,
    nextSlug,
  );
  await syncTenantAssetDirectory(current.slug, nextSlug);

  const now = new Date().toISOString();
  const updatedTenant = await updateTenantDocument(id, {
    name: nextName,
    nameAr: nextNameAr,
    slug: nextSlug,
    subdomain: nextSubdomain,
    status: nextStatus,
    draftScannerId: nextDraftScannerId,
    draftAttributeTemplateId:
      data.draftAttributeTemplateId !== undefined
        ? data.draftAttributeTemplateId
        : current.draftAttributeTemplateId,
    branding: normalizedBranding,
    content: mergedContent,
    updatedAt: now,
    archivedAt: nextStatus === 'archived' ? now : current.archivedAt ?? null,
  });

  if (!updatedTenant) {
    throw new Error('Tenant update failed.');
  }

  if (nextStatus !== 'active') {
    await deleteTenantAccessForTenant(id);
  }

  const hydrated = await getTenantById(id);
  if (!hydrated) {
    throw new Error('Tenant was updated but could not be loaded.');
  }

  return hydrated;
}

export async function updateTenantBranding(
  id: string,
  branding: Partial<Tenant['branding']>,
): Promise<Tenant> {
  return updateTenant(id, { branding });
}

export async function activateRuntimeConfig(
  tenantId: string,
  runtimeConfigId: string,
): Promise<Tenant> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);
  if (current.status === 'archived') {
    throw new Error('Archived tenants cannot make a survey live.');
  }

  const runtimeConfig = detailData.runtimeConfigs.find(
    (entry) => entry.runtimeConfigId === runtimeConfigId,
  );
  if (!runtimeConfig) {
    throw new Error('Published survey not found for this tenant.');
  }

  const activatedAt = new Date().toISOString();
  await activateRuntimeConfigForTenant({
    tenantId,
    runtimeConfigId,
    tenantStatus: 'active',
    activatedAt,
    updatedAt: activatedAt,
  });

  const hydrated = await getTenantById(tenantId);
  if (!hydrated) {
    throw new Error('Tenant activation completed but could not be loaded.');
  }

  return hydrated;
}

export async function publishTenantRuntime(
  tenantId: string,
  options: PublishTenantRuntimeOptions = { activate: true },
): Promise<TenantPublishResult> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);
  assertEditableTenant(current);

  const preview = await buildPublishingPreview(current, detailData);
  if (preview.existingMatchRuntimeConfigId) {
    const tenant = options.activate === false
      ? await getTenantById(tenantId)
      : await activateRuntimeConfig(tenantId, preview.existingMatchRuntimeConfigId);

    if (!tenant) {
      throw new Error('Matching published survey could not be loaded.');
    }

    const runtimeConfig = await getRuntimeConfigOptionsForTenant(tenantId);
    const matched = runtimeConfig.find(
      (entry) => entry.runtimeConfigId === preview.existingMatchRuntimeConfigId,
    );
    if (!matched) {
      throw new Error('Matching published survey could not be loaded.');
    }

    return {
      tenant,
      runtimeConfig: matched,
      preview,
    };
  }

  const firstBlockingIssue = preview.issues.find((issue) => issue.blocking);
  if (firstBlockingIssue) {
    throw new Error(firstBlockingIssue.message);
  }

  const resolvedSource = await resolvePublishingSource(current);
  if (!resolvedSource.scannerDetail || !resolvedSource.sourceVersion || !resolvedSource.sourceTemplate) {
    throw new Error('Publishing source could not be resolved.');
  }

  const now = new Date().toISOString();
  const runtimeConfigId = createRuntimeConfigId(current.subdomain || current.slug, detailData.runtimeConfigs);
  const generated = generateRuntimeConfig({
    tenant: createTenantSummary(current),
    branding: await resolveBrandingAssetPaths(
      current.slug,
      current.branding ?? {},
    ),
    content: current.content ?? {},
    runtimeSettings: clone(DEFAULT_RUNTIME_SETTINGS),
    sourceScanner: {
      scannerId: resolvedSource.scannerDetail.id,
      name: resolvedSource.scannerDetail.name,
      description: resolvedSource.scannerDetail.description,
      version: resolvedSource.sourceVersion,
    },
    sourceAttributeTemplate: resolvedSource.sourceTemplate,
    calculationVersionId: CALCULATION_VERSION_ID,
    runtimeConfigId,
    publishedAt: now,
    activatedAt: options.activate === false ? null : now,
    isActive: options.activate !== false,
    resolveVersionRefs: createVersionResolver(detailData, detailData.runtimeConfigs),
  });

  if (!generated.isValid || !generated.runtimeConfig || !generated.versionAssignment) {
    throw new Error(
      generated.issues.find((issue) => issue.blocking)?.message
      ?? 'Survey could not be published.',
    );
  }

  const runtimeFingerprint = getRuntimeConfigFingerprint(generated.runtimeConfig);
  const scannerSourceFingerprint = createScannerSourceFingerprint(
    resolvedSource.scannerDetail,
    resolvedSource.sourceVersion,
  );

  const scannerVersion: ScannerVersionDocument = {
    scannerVersionId: generated.runtimeConfig.versionRefs.scannerVersionId,
    tenantId,
    version: generated.runtimeConfig.scannerVersion.version,
    publishedAt: generated.runtimeConfig.publishedAt,
    isActive: options.activate !== false,
    categories: clone(generated.runtimeConfig.scannerVersion.categories),
    followUpTriggers: clone(generated.runtimeConfig.scannerVersion.followUpTriggers),
    createdAt: now,
    updatedAt: now,
    sourceScannerId: resolvedSource.scannerDetail.id,
    sourceScannerVersionId: resolvedSource.sourceVersion.id,
    sourceFingerprint: scannerSourceFingerprint,
    fingerprint: generated.fingerprints.scanner,
  };

  const attributeTemplateVersion: AttributeTemplateVersionDocument = {
    attributeTemplateVersionId: generated.runtimeConfig.versionRefs.attributeTemplateVersionId,
    tenantId,
    version: generated.versionAssignment.attributeTemplateVersion,
    publishedAt: generated.runtimeConfig.publishedAt,
    isActive: options.activate !== false,
    attributeTemplate: clone(generated.runtimeConfig.attributeTemplate),
    createdAt: now,
    updatedAt: now,
    sourceAttributeTemplateId: resolvedSource.sourceTemplate.id,
    fingerprint: generated.fingerprints.attributeTemplate,
  };

  const runtimeConfigDocument: RuntimeConfigDocument = {
    ...clone(generated.runtimeConfig),
    tenantId,
    tenantSlug: current.slug,
    tenantSubdomain: current.subdomain || current.slug,
    isActive: options.activate !== false,
    createdAt: now,
    updatedAt: now,
    fingerprint: runtimeFingerprint,
    brandingFingerprint: generated.fingerprints.branding ?? createFingerprint(current.branding ?? {}),
    sourceScannerId: resolvedSource.scannerDetail.id,
    sourceScannerVersionId: resolvedSource.sourceVersion.id,
    sourceAttributeTemplateId: resolvedSource.sourceTemplate.id,
  };

  await publishTenantRuntimeDocuments({
    tenantId,
    tenantUpdates: {
      activeRuntimeConfigId:
        options.activate === false ? current.activeRuntimeConfigId : runtimeConfigId,
      activeRuntimeConfigPublishedAt:
        options.activate === false
          ? current.activeRuntimeConfigPublishedAt ?? null
          : now,
      brandingVersionId: generated.runtimeConfig.versionRefs.brandingVersionId,
      status: options.activate === false ? current.status : 'active',
      updatedAt: now,
    },
    runtimeConfig: runtimeConfigDocument,
    scannerVersion,
    attributeTemplateVersion,
    activate: options.activate !== false,
  });

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error('Tenant was published but could not be loaded.');
  }

  const runtimeConfigOptions = await getRuntimeConfigOptionsForTenant(tenantId);
  const runtimeConfig = runtimeConfigOptions.find(
    (entry) => entry.runtimeConfigId === runtimeConfigId,
  );
  if (!runtimeConfig) {
    throw new Error('Published survey could not be loaded.');
  }

  return {
    tenant,
    runtimeConfig,
    preview,
  };
}

export async function archiveTenant(tenantId: string): Promise<Tenant> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);

  if (current.status === 'archived') {
    throw new Error('Tenant is already archived.');
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const archivedSubdomain = `archived_${current.slug}_${dateStr}`;

  const archivedTenant = await updateTenant(tenantId, {
    status: 'archived',
    subdomain: archivedSubdomain,
    archivedAt: now.toISOString(),
  });

  if (!archivedTenant) {
    throw new Error('Failed to archive tenant.');
  }

  return archivedTenant;
}

export async function restoreTenant(
  tenantId: string,
  newSubdomain?: string
): Promise<Tenant> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);

  if (current.status !== 'archived') {
    throw new Error('Only archived tenants can be restored.');
  }

  if (newSubdomain) {
    const subdomainValidation = validateTenantSubdomain(newSubdomain);
    if (subdomainValidation.errors.length > 0) {
      throw new Error(subdomainValidation.errors[0]);
    }

    const listData = await getTenantListData();
    const subdomainTaken = listData.tenants.some(
      (t) => t.subdomain === subdomainValidation.normalized && t.tenantId !== tenantId
    );

    if (subdomainTaken) {
      throw new Error(`Subdomain "${subdomainValidation.normalized}" is already in use.`);
    }

    return updateTenant(tenantId, {
      status: 'disabled',
      subdomain: subdomainValidation.normalized,
      archivedAt: null,
    });
  }

  const originalSubdomain = current.subdomain?.replace(/^archived_.*_/, '') || current.slug;

  const listData = await getTenantListData();
  const originalTaken = listData.tenants.some(
    (t) => (t.subdomain || t.slug) === originalSubdomain && t.tenantId !== tenantId
  );

  if (originalTaken) {
    throw new Error(
      `The original subdomain "${originalSubdomain}" is already in use. Please provide a new subdomain to restore.`
    );
  }

  return updateTenant(tenantId, {
    status: 'disabled',
    subdomain: originalSubdomain,
    archivedAt: null,
  });
}

export interface DeleteTenantConsequences {
  tenantId: string;
  slug: string;
  name: string;
  status: TenantStatus;
  submissionCount: number;
  runtimeConfigCount: number;
  hasActiveSurvey: boolean;
  hasBrandingAssets: boolean;
}

export async function previewDeleteTenant(
  tenantId: string,
): Promise<DeleteTenantConsequences> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);
  const submissionCount = detailData.tenantSubmissionCounts[current.tenantId] ?? 0;
  const runtimeConfigCount = detailData.runtimeConfigs.length;

  let hasBrandingAssets = false;
  try {
    const { tenantDirectoryPath } = getTenantAssetPaths(current.slug);
    const stat = await import('node:fs/promises').then((fs) =>
      fs.stat(tenantDirectoryPath).catch(() => null),
    );
    hasBrandingAssets = stat !== null;
  } catch {
    hasBrandingAssets = false;
  }

  return {
    tenantId: current.tenantId,
    slug: current.slug,
    name: current.name,
    status: current.status,
    submissionCount,
    runtimeConfigCount,
    hasActiveSurvey: Boolean(current.activeRuntimeConfigId),
    hasBrandingAssets,
  };
}

export async function deleteTenant(
  tenantId: string,
  confirmation?: { slug: string; acknowledgeDataLoss: boolean },
): Promise<void> {
  await ensureTenantModuleIndexes();
  const detailData = await getTenantDetailData(tenantId);
  if (!detailData.tenant) {
    throw new Error('Tenant not found.');
  }

  const current = normalizeTenantDocument(detailData.tenant);
  const submissionCount = detailData.tenantSubmissionCounts[current.tenantId] ?? 0;
  const runtimeConfigCount = detailData.runtimeConfigs.length;

  // Require slug confirmation regardless
  if (!confirmation || confirmation.slug.trim() !== current.slug) {
    throw new Error(`Type the tenant slug "${current.slug}" to confirm deletion.`);
  }

  // If there's data to lose, require explicit acknowledgement
  const hasConsequences = submissionCount > 0 || runtimeConfigCount > 0 || Boolean(current.activeRuntimeConfigId);
  if (hasConsequences && !confirmation.acknowledgeDataLoss) {
    throw new Error(
      'This tenant has submissions or published surveys. Acknowledge the data loss to proceed.',
    );
  }

  // Clean up all associated collections in parallel
  await Promise.all([
    deleteRuntimeConfigsForTenant(tenantId),
    deleteScannerVersionsForTenant(tenantId),
    deleteAttributeTemplateVersionsForTenant(tenantId),
    deleteRawResponsesForTenant(tenantId),
    deleteTenantAccessForTenant(tenantId),
  ]);

  // Clean up asset files on disk
  try {
    const { tenantDirectoryPath } = getTenantAssetPaths(current.slug);
    await rm(tenantDirectoryPath, { recursive: true, force: true });
  } catch {
    // Asset directory may not exist — that's fine
  }

  // Finally, delete the tenant document itself
  await deleteTenantDocument(tenantId);
}

export async function getTenantStats(): Promise<{
  total: number;
  draft: number;
  active: number;
  disabled: number;
  archived: number;
  activeRuntimeConfigs: number;
  byBranding: Record<string, number>;
  totalSubmissions: number;
}> {
  await ensureTenantModuleIndexes();
  const listData = await getTenantListData();

  return {
    total: listData.tenants.length,
    draft: listData.tenants.filter((tenant) => tenant.status === 'draft').length,
    active: listData.tenants.filter((tenant) => tenant.status === 'active').length,
    disabled: listData.tenants.filter((tenant) => tenant.status === 'disabled').length,
    archived: listData.tenants.filter((tenant) => tenant.status === 'archived').length,
    activeRuntimeConfigs: listData.tenants.filter((tenant) => Boolean(tenant.activeRuntimeConfigId)).length,
    byBranding: {
      custom: listData.tenants.filter((tenant) =>
        JSON.stringify(resolveBrandingConfig(tenant.branding ?? {}))
        !== JSON.stringify(resolveBrandingConfig({}))).length,
      default: listData.tenants.filter((tenant) =>
        JSON.stringify(resolveBrandingConfig(tenant.branding ?? {}))
        === JSON.stringify(resolveBrandingConfig({}))).length,
      warnings: listData.tenants.filter(
        (tenant) => validateBrandingConfig(tenant.branding ?? {}).warnings.length > 0,
      ).length,
    },
    totalSubmissions: Object.values(listData.tenantSubmissionCounts).reduce(
      (total, count) => total + count,
      0,
    ),
  };
}
