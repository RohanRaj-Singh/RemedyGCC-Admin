/**
 * Scanner Module Types
 * Defines survey scanner structures
 */

import { AttributeTemplate } from '../attribute-template/types';

// Question in a scanner survey
export interface Question {
  id: string;
  text: string;
  options: string[];
  weight: number;
}

// Scanner status
export type ScannerStatus = 'draft' | 'published' | 'archived';

// Scanner entity
export interface Scanner {
  id: string;
  name: string;
  description?: string;
  templateId: string;
  templateName?: string; // Populated from template
  questions: Question[];
  status: ScannerStatus;
  createdAt: string;
  updatedAt: string;
}

// Create Scanner DTO
export interface CreateScannerDto {
  name: string;
  description?: string;
  templateId: string;
  questions: Omit<Question, 'id'>[];
}

// Update Scanner DTO
export interface UpdateScannerDto {
  name?: string;
  description?: string;
  questions?: Omit<Question, 'id'>[];
  status?: ScannerStatus;
}

// Template option for selector
export interface TemplateOption {
  id: string;
  name: string;
  description?: string;
  fieldCount: number;
}

// Weight validation result
export interface WeightValidation {
  isValid: boolean;
  total: number;
  remaining: number;
  hasError: boolean;
  hasWarning: boolean;
  error?: string;
  warning?: string;
}
