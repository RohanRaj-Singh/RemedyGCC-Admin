/**
 * Calculation Engine - Core Type Contracts
 *
 * This module provides pure, deterministic calculation infrastructure
 * for the RemedyGCC scoring system.
 *
 * Core Concept: Weighted Normalized Domain Scoring
 * - Higher % = healthier outcome for health score
 * - Higher % = higher risk for risk score
 * - Answer scale: 4 = healthiest, 1 = highest risk (NO inversion needed)
 */

/**
 * Formula type for score calculation
 * - health: Returns percentage where higher = healthier
 * - risk: Returns percentage where higher = higher risk
 */
export type FormulaType = 'health' | 'risk';

/**
 * Answer value from respondent
 * Scale: 4 = healthiest, 1 = highest risk
 */
export type AnswerValue = 1 | 2 | 3 | 4;

/**
 * Question weight in a domain (0-100)
 * Higher weight = more impact on final score
 */
export type QuestionWeight = number;

/**
 * Domain identifier
 */
export type DomainId = string;

/**
 * Question identifier within a scanner
 */
export type QuestionId = string;

/**
 * Category identifier
 */
export type CategoryId = string;

/**
 * Question metadata from scanner definition
 */
export interface QuestionDefinition {
  id: QuestionId;
  categoryId: CategoryId;
  weight: QuestionWeight;
  domainId: DomainId;
}

/**
 * Domain metadata from scanner definition
 */
export interface DomainDefinition {
  id: DomainId;
  formulaType: FormulaType;
  name: string;
}

/**
 * Category metadata from scanner definition
 */
export interface CategoryDefinition {
  id: CategoryId;
  name: string;
}

/**
 * Scanner structure containing question, domain, and category definitions
 */
export interface ScannerStructure {
  scannerId: string;
  version: string;
  questions: QuestionDefinition[];
  domains: DomainDefinition[];
  categories: CategoryDefinition[];
}

/**
 * Single answer from a respondent
 */
export interface ResponseAnswer {
  questionId: QuestionId;
  answer: AnswerValue;
}

/**
 * All responses for a single submission
 */
export interface SubmissionResponses {
  submissionId: string;
  tenantId: string;
  scannerId: string;
  scannerVersion: string;
  responses: ResponseAnswer[];
  submittedAt: string;
}

/**
 * Input to the calculation engine
 * Contains scanner structure and submission responses
 */
export interface CalculationInput {
  scanner: ScannerStructure;
  submission: SubmissionResponses;
  /**
   * Optional: Include metadata in results for traceability
   * @default true
   */
  includeTraceability?: boolean;
}

/**
 * Weighted Raw Score for a single question
 * WRS = RawScore × QuestionWeight
 */
export interface WeightedQuestionResult {
  questionId: QuestionId;
  domainId: DomainId;
  rawScore: AnswerValue;
  weight: QuestionWeight;
  weightedScore: number;
}

/**
 * Domain-level calculation result
 */
export interface DomainCalculationResult {
  domainId: DomainId;
  domainName: string;
  formulaType: FormulaType;
  weightedScores: WeightedQuestionResult[];
  /**
   * Sum of Weighted Raw Scores (ΣWRS)
   */
  sumWeightedScores: number;
  /**
   * Maximum Possible Score (MPS)
   * MPS = Σ(question weights) × 4 (max answer value)
   */
  maximumPossibleScore: number;
  /**
   * Normalized percentage score
   * - For health: (ΣWRS / MPS) × 100
   * - For risk: (1 - ΣWRS / MPS) × 100
   */
  normalizedScore: number;
  questionCount: number;
}

/**
 * Complete submission calculation result
 */
export interface SubmissionCalculationResult {
  submissionId: string;
  tenantId: string;
  scannerId: string;
  scannerVersion: string;
  submittedAt: string;
  domainResults: DomainCalculationResult[];
  /**
   * Total ΣWRS across all questions
   */
  totalWeightedScores: number;
  /**
   * Total MPS across all questions
   */
  totalMaximumPossibleScore: number;
  /**
   * Overall normalized score (weighted average of domain scores)
   */
  overallScore: number;
  /**
   * Traceability metadata
   */
  calculatedAt: string;
  calculationVersion: string;
}

/**
 * Validation error from calculation engine
 */
export interface CalculationError {
  code: 'INVALID_ANSWER' | 'INVALID_WEIGHT' | 'MISSING_RESPONSE' | 'UNKNOWN_DOMAIN' | 'INVALID_FORMULA';
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Validation result from input validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: CalculationError[];
}

/**
 * Formula normalizer function signature
 */
export type FormulaNormalizer = (
  sumWeightedScores: number,
  maximumPossibleScore: number
) => number;

/**
 * Formula registry mapping formula types to normalizers
 */
export interface FormulaRegistry {
  [key: string]: FormulaNormalizer;
}

/**
 * Domain result for quick lookup
 */
export type DomainResultMap = Record<DomainId, DomainCalculationResult>;