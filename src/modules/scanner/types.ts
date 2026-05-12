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

export interface QuestionOption {
  id: string;
  order: number;
  label: LocalizedText;
  score: number;
}

export interface ScannerFollowUpTrigger {
  id: string;
  triggerQuestionId: string;
  triggerOptionIds: string[];
  followUpQuestionIds: string[];
}

export interface Question {
  id: string;
  order: number;
  subdomainId: string;
  text: LocalizedText;
  weight?: number;
  kind: 'primary' | 'follow-up';
  options: QuestionOption[];
}

export interface Subdomain {
  id: string;
  order: number;
  categoryId: string;
  name: LocalizedText;
  weight: number;
  questions: Question[];
}

export interface Category {
  id: string;
  order: number;
  slot: 1 | 2 | 3 | 4 | 5;
  name: LocalizedText;
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
  followUpTriggers: ScannerFollowUpTrigger[];
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

export type ValidationIssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  code: string;
  level: ValidationIssueLevel;
  severity: ValidationIssueSeverity;
  categoryId?: string;
  categoryName?: string;
  subdomainId?: string;
  subdomainName?: string;
  questionId?: string;
  questionText?: string;
  answerId?: string;
  answerLabel?: string;
  followUpRelation?: string;
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
  followUpTriggers: ScannerFollowUpTrigger[];
}
