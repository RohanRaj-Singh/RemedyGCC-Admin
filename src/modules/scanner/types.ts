/**
 * Scanner Module Types
 * Strict admin-side scanner builder domain for RemedyGCC.
 */

import { AttributeTemplate } from '../attribute-template/types';

export interface LocalizedText {
  en: string;
  ar: string;
}

export type ScannerStatus = 'draft' | 'published' | 'archived';
export type ScannerVersionStatus = 'draft' | 'published';
export type CategoryPolarity = 'positive' | 'negative';

export interface QuestionOption {
  id: string;
  label: LocalizedText;
  scoreValue: number;
}

export interface FollowUpTriggerCondition {
  questionId: string;
  optionIds: string[];
}

export interface Question {
  id: string;
  subdomainId: string;
  text: LocalizedText;
  weight: number;
  isFollowUp: boolean;
  triggerCondition?: FollowUpTriggerCondition;
  options: QuestionOption[];
}

export interface Subdomain {
  id: string;
  categoryId: string;
  name: LocalizedText;
  weight: number;
  questions: Question[];
}

export interface Category {
  id: string;
  slot: 1 | 2 | 3 | 4 | 5;
  name: LocalizedText;
  polarity: CategoryPolarity;
  weight: number;
  subdomains: Subdomain[];
}

export interface ScannerVersion {
  id: string;
  scannerId: string;
  versionNumber: number;
  status: ScannerVersionStatus;
  sourceVersionId: string | null;
  attributeTemplateId: string;
  attributeTemplateName?: string;
  attributeTemplateSnapshot: AttributeTemplate | null;
  categories: Category[];
  responseCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScannerVersionSummary {
  id: string;
  versionNumber: number;
  status: ScannerVersionStatus;
  sourceVersionId: string | null;
  responseCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  isImmutable: boolean;
}

export interface Scanner {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  status: ScannerStatus;
  latestVersionNumber: number;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  attributeTemplateId: string | null;
  attributeTemplateName?: string;
  categoryCount: number;
  subdomainCount: number;
  questionCount: number;
  hasResponses: boolean;
  hasUnpublishedChanges: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScannerDetail extends Scanner {
  draftVersion: ScannerVersion | null;
  publishedVersion: ScannerVersion | null;
  versions: ScannerVersionSummary[];
}

export interface TemplateOption {
  id: string;
  name: string;
  description?: string;
  streamCount: number;
  locationCount: number;
  functionCount: number;
  departmentCount: number;
}

export type ValidationIssueLevel =
  | 'scanner'
  | 'category'
  | 'subdomain'
  | 'question'
  | 'attribute-template';

export interface ValidationIssue {
  code: string;
  level: ValidationIssueLevel;
  entityId?: string;
  path: string;
  message: string;
  blocking: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface CreateScannerDto {
  name: LocalizedText;
  description?: LocalizedText;
  attributeTemplateId: string;
}

export interface SaveScannerDraftDto {
  name: LocalizedText;
  description?: LocalizedText;
  attributeTemplateId: string;
  categories: Category[];
}
