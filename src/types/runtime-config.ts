import type { BrandingConfig } from './branding';
import type { TenantContentConfig } from './content';

export interface LocalizedText {
  en: string;
  ar: string;
}

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
  labelTranslations?: LocalizedText;
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
  labelTranslations?: LocalizedText;
  placeholderTranslations?: LocalizedText;
}

export interface RuntimeAttributeTemplate {
  streams: RuntimeAttributeOption[];
  locations: RuntimeAttributeLocationOption[];
  functions: RuntimeAttributeFunctionOption[];
  departments: RuntimeAttributeDepartmentOption[];
  genders?: RuntimeAttributeOption[];
  ageGroups?: RuntimeAttributeOption[];
  seniorityLevels?: RuntimeAttributeOption[];
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
  labelTranslations?: LocalizedText;
  score: number;
}

export interface RuntimeScannerQuestion {
  id: string;
  order: number;
  questionText: string;
  questionTextTranslations?: LocalizedText;
  weight: number;
  kind: 'primary' | 'follow-up';
  answers: RuntimeScannerAnswerOption[];
  helpText?: string;
}

export interface RuntimeScannerSubdomain {
  id: string;
  order: number;
  label: string;
  labelTranslations?: LocalizedText;
  description: string;
  descriptionTranslations?: LocalizedText;
  weight: number;
  questions: RuntimeScannerQuestion[];
}

export interface RuntimeScannerCategory {
  id: string;
  order: number;
  label: string;
  labelTranslations?: LocalizedText;
  description: string;
  descriptionTranslations?: LocalizedText;
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
  nameTranslations?: LocalizedText;
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
  content: TenantContentConfig;
  attributeTemplate: RuntimeAttributeTemplate;
  scannerVersion: RuntimeScannerVersion;
  runtimeSettings: RuntimeSettings;
}
