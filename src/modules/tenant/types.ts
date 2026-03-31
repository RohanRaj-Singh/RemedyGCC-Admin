/**
 * Tenant Module Types
 * Defines tenant structures for multi-tenant SaaS platform
 */

import { BrandingConfig, ColorScheme, BrandingAssets } from '@/types/branding';
export type { BrandingConfig, ColorScheme, BrandingAssets };

export { DEFAULT_BRANDING, getBrandingWithDefault, colorSchemeToCSSVars } from '@/types/branding';

export type TenantStatus = 'active' | 'inactive' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  subdomain: string;
  status: TenantStatus;
  branding: BrandingConfig;
  createdAt: string;
  updatedAt: string;
  assignedScannerId?: string;
  assignedScannerName?: string;
  scannerId?: string | null;
  totalSubmissions: number;
}

export interface CreateTenantDto {
  name: string;
  subdomain: string;
  status?: TenantStatus;
  branding?: Partial<BrandingConfig>;
}

export interface UpdateTenantDto {
  name?: string;
  subdomain?: string;
  status?: TenantStatus;
  branding?: Partial<BrandingConfig>;
  assignedScannerId?: string | null;
}

export interface UpdateBrandingDto {
  logoUrl?: string;
  faviconUrl?: string;
  colorScheme?: Partial<ColorScheme>;
  fontFamily?: string;
  assets?: Partial<BrandingAssets>;
}

export interface ScannerOption {
  id: string;
  name: string;
  description?: string;
  status: string;
}