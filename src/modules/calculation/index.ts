/**
 * Calculation Engine Module
 *
 * Pure, deterministic calculation infrastructure for the RemedyGCC scoring system.
 *
 * Core Concepts:
 * - Weighted Normalized Domain Scoring
 * - Health Score: (ΣWRS / MPS) × 100
 * - Risk Score: (1 - ΣWRS / MPS) × 100
 * - Answer scale: 4 = healthiest, 1 = highest risk
 *
 * Usage:
 * ```ts
 * import { calculateSubmission } from '@/modules/calculation';
 *
 * const result = calculateSubmission({
 *   scanner: scannerStructure,
 *   submission: submissionData,
 * });
 * ```
 */

// Core engine exports
export {
  calculateSubmission,
  calculateDomainScore,
  calculateWeightedQuestionScore,
  calculateSingleDomain,
  calculateMaximumPossibleScore,
  createWeightedQuestionResult,
  validateInput,
  getDomainResult,
  engineVersion,
} from './engine';

// Formula exports
export {
  formulaRegistry,
  getFormula,
  hasFormula,
  getRegisteredFormulas,
  normalizeHealthScore,
  normalizeRiskScore,
  getFormulaNormalizer,
} from './formulas';

// Type exports
export type {
  FormulaType,
  AnswerValue,
  QuestionWeight,
  DomainId,
  QuestionId,
  CategoryId,
  QuestionDefinition,
  DomainDefinition,
  CategoryDefinition,
  ScannerStructure,
  ResponseAnswer,
  SubmissionResponses,
  CalculationInput,
  WeightedQuestionResult,
  DomainCalculationResult,
  SubmissionCalculationResult,
  CalculationError,
  ValidationResult,
  FormulaNormalizer,
  FormulaRegistry,
  DomainResultMap,
} from './contracts/types';