import type {
  BrandingConfig,
  BrandingValidationResult,
  ResolvedBrandingConfig,
} from '@/types/branding';

export type { BrandingConfig, BrandingValidationResult, ResolvedBrandingConfig };

export type TenantStatus = 'draft' | 'active' | 'disabled' | 'archived';

export type RuntimeConfigStatus = 'draft' | 'published' | 'archived';

export interface RuntimeVersionRefs {
  scannerVersionId: string;
  attributeTemplateVersionId: string;
  calculationVersionId: string;
  brandingVersionId: string;
}

export interface TenantRuntimeConfigReference {
  runtimeConfigId: string;
  tenantId: string;
  tenantSlug: string;
  status: RuntimeConfigStatus;
  publishedAt: string | null;
  activatedAt: string | null;
  versionRefs: RuntimeVersionRefs;
}

export interface RuntimeConfigOption extends TenantRuntimeConfigReference {
  isActive: boolean;
  label: string;
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
  name: string;
  status: TenantStatus;
  activeRuntimeConfigId: string | null;
  branding: BrandingConfig;
  createdAt: string;
  updatedAt: string;
  activeRuntimeConfig?: TenantRuntimeConfigReference | null;
  publishingReadiness?: TenantPublishingReadiness;
  brandingWarnings?: string[];
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  status?: TenantStatus;
  branding?: Partial<BrandingConfig>;
  activeRuntimeConfigId?: string | null;
}

export interface UpdateTenantDto {
  name?: string;
  slug?: string;
  status?: TenantStatus;
  branding?: Partial<BrandingConfig>;
  activeRuntimeConfigId?: string | null;
}

export interface UpdateBrandingDto {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  fontFamily?: string;
  gradients?: Partial<ResolvedBrandingConfig['gradients']>;
}
