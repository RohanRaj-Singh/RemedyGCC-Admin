/**
 * Super Admin Dashboard - TypeScript Type Definitions
 * Defines all data structures for the RemedyGCC Super Admin module
 */

import { BrandingConfig, ColorScheme, BrandingAssets } from './branding';

export type { BrandingConfig, ColorScheme, BrandingAssets };

export type TenantStatus = 'active' | 'inactive' | 'suspended';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  status: TenantStatus;
  branding: BrandingConfig;
  createdAt: string;
  updatedAt: string;
  subdomain: string;
  assignedScannerId?: string;
  assignedScannerName?: string;
  scannerId?: string | null;
  totalSubmissions: number;
}

export interface Scanner {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  questions: Question[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface Question {
  id: string;
  text: string;
  type: 'single' | 'multiple' | 'scale';
  required: boolean;
  options: QuestionOption[];
  weight: number;
}

export interface QuestionOption {
  id: string;
  text: string;
  weight: number;
}

export interface SystemLog {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  module: 'tenant' | 'scanner' | 'submission' | 'system';
  tenantId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  activeScanners: number;
  totalLogs: number;
  totalSubmissions: number;
  avgScore: number;
  tenantsByBranding: {
    custom: number;
    default: number;
  };
  recentActivity: {
    date: string;
    submissions: number;
    newTenants: number;
  }[];
}

export interface UpdateBrandingDto {
  logoUrl?: string;
  faviconUrl?: string;
  colorScheme?: Partial<ColorScheme>;
  fontFamily?: string;
  assets?: Partial<BrandingAssets>;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  domain: string;
  status?: TenantStatus;
  branding?: Partial<BrandingConfig>;
}