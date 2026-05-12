import type { BrandingConfig } from './branding';

export type RuntimeConfigStatus =
  | 'draft'
  | 'published'
  | 'active'
  | 'disabled'
  | 'archived';

export interface RuntimeVersionRefs {
  scannerVersionId: string;
  attributeTemplateVersionId: string;
  calculationVersionId: string;
  brandingVersionId: string;
}

export interface RuntimeSettings {
  allowAnonymous: boolean;
  requireAuthentication: boolean;
  surveyExpirationDays: number;
  allowMultipleSubmissions: boolean;
  language: 'en' | 'ar';
  featureFlags: Record<string, boolean>;
}

export interface RuntimeAttributeOption {
  id: string;
  label: string;
  value: string;
}

export interface RuntimeAttributeLocationOption extends RuntimeAttributeOption {
  streamId: string;
}

export interface RuntimeAttributeFunctionOption extends RuntimeAttributeOption {
  locationId: string;
}

export interface RuntimeAttributeDepartmentOption extends RuntimeAttributeOption {
  functionId: string;
}

export interface RuntimeFixedAttributeConfig {
  enabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
}

export interface RuntimeAttributeTemplate {
  streams: RuntimeAttributeOption[];
  locations: RuntimeAttributeLocationOption[];
  functions: RuntimeAttributeFunctionOption[];
  departments: RuntimeAttributeDepartmentOption[];
  genders?: string[];
  ageGroups?: string[];
  seniorityLevels?: string[];
  fixedAttributes?: {
    location?: RuntimeFixedAttributeConfig;
    gender?: RuntimeFixedAttributeConfig;
    age?: RuntimeFixedAttributeConfig;
    seniority?: RuntimeFixedAttributeConfig;
  };
}

export interface RuntimeScannerAnswerOption {
  id: string;
  order: number;
  label: string;
  score: number;
}

export interface RuntimeScannerQuestion {
  id: string;
  order: number;
  questionText: string;
  weight: number;
  kind: 'primary' | 'follow-up';
  answers: RuntimeScannerAnswerOption[];
  helpText?: string;
}

export interface RuntimeScannerSubdomain {
  id: string;
  order: number;
  label: string;
  description: string;
  weight: number;
  questions: RuntimeScannerQuestion[];
}

export interface RuntimeScannerCategory {
  id: string;
  order: number;
  label: string;
  description: string;
  weight: number;
  subdomains: RuntimeScannerSubdomain[];
}

export interface RuntimeScannerFollowUpTrigger {
  id: string;
  triggerQuestionId: string;
  triggerAnswerScores: number[];
  followUpQuestionIds: string[];
}

export interface RuntimeScannerVersion {
  id: string;
  version: string;
  publishedAt: string;
  isActive: boolean;
  categories: RuntimeScannerCategory[];
  followUpTriggers: RuntimeScannerFollowUpTrigger[];
}

export interface RuntimeTenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface TenantRuntimeConfigSnapshot {
  runtimeConfigId: string;
  publishedAt: string;
  activatedAt: string | null;
  tenant: RuntimeTenantSummary;
  versionRefs: RuntimeVersionRefs;
  branding: BrandingConfig;
  attributeTemplate: RuntimeAttributeTemplate;
  scannerVersion: RuntimeScannerVersion;
  runtimeSettings: RuntimeSettings;
}
