import type {
  BrandingConfig,
  BrandingValidationResult,
  ResolvedBrandingConfig,
} from '@/types/branding';
import type {
  RuntimeConfigStatus,
  RuntimeVersionRefs,
  TenantRuntimeConfigSnapshot,
} from '@/types/runtime-config';
import type { PublishValidationIssue } from '@/modules/publishing/engine';

export type { BrandingConfig, BrandingValidationResult, ResolvedBrandingConfig };

export type TenantStatus = 'draft' | 'active' | 'disabled' | 'archived';

export interface TenantDraftSetupReference {
  id: string;
  label: string;
  description?: string;
}

export interface TenantRuntimeScannerSummary {
  scannerVersionId: string;
  version: string;
  categoryCount: number;
  subdomainCount: number;
  questionCount: number;
}

export interface TenantRuntimeAttributeTemplateSummary {
  attributeTemplateVersionId: string;
  streamCount: number;
  locationCount: number;
  functionCount: number;
  departmentCount: number;
}

export interface TenantRuntimeConfigReference {
  runtimeConfigId: string;
  tenantId: string;
  tenantSlug: string;
  tenantSubdomain: string;
  status: RuntimeConfigStatus;
  publishedAt: string | null;
  activatedAt: string | null;
  versionRefs: RuntimeVersionRefs;
  submissionCount: number;
  scannerSummary: TenantRuntimeScannerSummary;
  attributeTemplateSummary: TenantRuntimeAttributeTemplateSummary;
}

export interface RuntimeConfigOption extends TenantRuntimeConfigReference {
  isActive: boolean;
  label: string;
}

export type TenantPublishingIssue = PublishValidationIssue;

export interface TenantPublishingPreview {
  status: RuntimeConfigStatus;
  isReady: boolean;
  issues: TenantPublishingIssue[];
  warnings: string[];
  runtimeConfig: TenantRuntimeConfigSnapshot | null;
  existingMatchRuntimeConfigId: string | null;
}

export interface TenantPublishingReadiness {
  canActivate: boolean;
  canPublish: boolean;
  hasPendingChanges: boolean;
  blockingIssues: string[];
  warnings: string[];
}

export interface Tenant {
  id: string;
  slug: string;
  subdomain: string;
  name: string;
  status: TenantStatus;
  draftScannerId: string | null;
  draftAttributeTemplateId: string | null;
  activeRuntimeConfigId: string | null;
  branding: BrandingConfig;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  submissionCount: number;
  runtimeConfigCount: number;
  draftScanner?: TenantDraftSetupReference | null;
  draftAttributeTemplate?: TenantDraftSetupReference | null;
  activeRuntimeConfig?: TenantRuntimeConfigReference | null;
  publishingReadiness?: TenantPublishingReadiness;
  brandingWarnings?: string[];
  publishingPreview?: TenantPublishingPreview | null;
}

export interface TenantSetupOption {
  id: string;
  label: string;
  description?: string;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  subdomain: string;
  status?: TenantStatus;
  draftScannerId?: string | null;
  draftAttributeTemplateId?: string | null;
  branding?: Partial<BrandingConfig>;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  subdomain?: string;
  status?: TenantStatus;
  draftScannerId?: string | null;
  draftAttributeTemplateId?: string | null;
  branding?: Partial<BrandingConfig>;
  archivedAt?: string | null;
}

export interface UpdateBrandingDto {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  gradient?: Partial<ResolvedBrandingConfig['gradient']>;
}

export interface PublishTenantRuntimeOptions {
  activate?: boolean;
}

export interface TenantPublishResult {
  tenant: Tenant;
  runtimeConfig: RuntimeConfigOption;
  preview: TenantPublishingPreview;
}
