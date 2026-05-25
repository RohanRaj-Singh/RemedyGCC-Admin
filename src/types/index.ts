/**
 * Shared type surface for the Super Admin app.
 */

export type {
  BrandingConfig,
  BrandingGradients,
  BrandingValidationResult,
  ResolvedBrandingConfig,
} from './branding';
export type {
  TenantContentConfig,
  TenantContentText,
  TenantPageContentConfig,
} from './content';
export {
  normalizeTenantContentConfig,
  normalizeTenantContentText,
} from './content';
export {
  DEFAULT_BRANDING,
  brandingToCSSVars,
  getBrandingWithDefault,
  getReadableTextColor,
  hexToRgba,
  isDefaultBranding,
  isSafeAssetReference,
  isValidBrandingConfig,
  isValidHexColor,
  mixHexColors,
  normalizeHexColor,
  resolveBrandingConfig,
  validateBrandingConfig,
} from './branding';
export type {
  RuntimeAttributeDepartmentOption,
  RuntimeAttributeFunctionOption,
  RuntimeAttributeLocationOption,
  RuntimeAttributeOption,
  RuntimeAttributeTemplate,
  RuntimeConfigStatus,
  RuntimeFixedAttributeConfig,
  RuntimeScannerAnswerOption,
  RuntimeScannerCategory,
  RuntimeScannerFollowUpTrigger,
  RuntimeScannerQuestion,
  RuntimeScannerSubdomain,
  RuntimeScannerVersion,
  RuntimeSettings,
  RuntimeTenantSummary,
  RuntimeVersionRefs,
  TenantRuntimeConfigSnapshot,
} from './runtime-config';

export type {
  CreateTenantDto,
  RuntimeConfigOption,
  Tenant,
  TenantPublishingReadiness,
  TenantPublishingPreview,
  TenantPublishResult,
  TenantPublishingIssue,
  TenantRuntimeConfigReference,
  TenantStatus,
  UpdateBrandingDto,
  UpdateTenantDto,
} from '@/modules/tenant/types';
export type {
  TenantDashboardAccessCreateInput,
  TenantDashboardAccessSummary,
  TenantPasswordResetResult,
  TenantUserProfile,
} from '@/modules/tenant-auth/contracts/types';

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
  draftTenants?: number;
  disabledTenants?: number;
  archivedTenants?: number;
  activeRuntimeConfigs?: number;
  activeScanners?: number;
  totalLogs: number;
  totalSubmissions?: number;
  avgScore?: number;
  tenantsByBranding: {
    custom: number;
    default: number;
    withWarnings?: number;
  };
  recentActivity: {
    date: string;
    submissions: number;
    newTenants: number;
  }[];
}
