/**
 * Calculation Engine - Test Fixtures
 *
 * Deterministic test data for unit tests.
 * Based on the document formulas:
 * - HealthScore = (ΣWRS / MPS) × 100
 * - RiskScore = (1 - ΣWRS / MPS) × 100
 * - WRS = RawScore × QuestionWeight
 */

import type {
  CalculationInput,
  ScannerStructure,
  SubmissionResponses,
  AnswerValue,
} from '../contracts/types';

/**
 * Example scanner with two domains:
 * - "health" domain (higher = healthier)
 * - "risk" domain (higher = higher risk)
 */
export const sampleScanner: ScannerStructure = {
  scannerId: 'scanner-001',
  version: '1.0.0',
  questions: [
    // Health domain questions (category: wellness)
    { id: 'q1', categoryId: 'cat-wellness', weight: 30, domainId: 'health' },
    { id: 'q2', categoryId: 'cat-wellness', weight: 20, domainId: 'health' },
    { id: 'q3', categoryId: 'cat-wellness', weight: 50, domainId: 'health' },
    // Risk domain questions (category: safety)
    { id: 'q4', categoryId: 'cat-safety', weight: 40, domainId: 'risk' },
    { id: 'q5', categoryId: 'cat-safety', weight: 60, domainId: 'risk' },
  ],
  domains: [
    { id: 'health', formulaType: 'health', name: 'Health & Wellness' },
    { id: 'risk', formulaType: 'risk', name: 'Risk Assessment' },
  ],
  categories: [
    { id: 'cat-wellness', name: 'Wellness' },
    { id: 'cat-safety', name: 'Safety' },
  ],
};

/**
 * Sample submission with varied answers
 *
 * Answers: 4 = healthiest, 1 = highest risk
 */
export const sampleSubmission: SubmissionResponses = {
  submissionId: 'sub-001',
  tenantId: 'tenant-001',
  scannerId: 'scanner-001',
  scannerVersion: '1.0.0',
  responses: [
    { questionId: 'q1', answer: 4 as AnswerValue }, // best health answer
    { questionId: 'q2', answer: 3 as AnswerValue },
    { questionId: 'q3', answer: 2 as AnswerValue },
    { questionId: 'q4', answer: 1 as AnswerValue }, // worst risk answer (high risk)
    { questionId: 'q5', answer: 2 as AnswerValue },
  ],
  submittedAt: '2024-01-15T10:30:00Z',
};

/**
 * Full calculation input combining scanner and submission
 */
export const sampleCalculationInput: CalculationInput = {
  scanner: sampleScanner,
  submission: sampleSubmission,
};

/**
 * Perfect submission - all answers are 4 (healthiest)
 */
export const perfectSubmission: SubmissionResponses = {
  submissionId: 'sub-perfect',
  tenantId: 'tenant-001',
  scannerId: 'scanner-001',
  scannerVersion: '1.0.0',
  responses: [
    { questionId: 'q1', answer: 4 as AnswerValue },
    { questionId: 'q2', answer: 4 as AnswerValue },
    { questionId: 'q3', answer: 4 as AnswerValue },
    { questionId: 'q4', answer: 4 as AnswerValue },
    { questionId: 'q5', answer: 4 as AnswerValue },
  ],
  submittedAt: '2024-01-15T10:30:00Z',
};

/**
 * Worst submission - all answers are 1 (highest risk)
 */
export const worstSubmission: SubmissionResponses = {
  submissionId: 'sub-worst',
  tenantId: 'tenant-001',
  scannerId: 'scanner-001',
  scannerVersion: '1.0.0',
  responses: [
    { questionId: 'q1', answer: 1 as AnswerValue },
    { questionId: 'q2', answer: 1 as AnswerValue },
    { questionId: 'q3', answer: 1 as AnswerValue },
    { questionId: 'q4', answer: 1 as AnswerValue },
    { questionId: 'q5', answer: 1 as AnswerValue },
  ],
  submittedAt: '2024-01-15T10:30:00Z',
};

/**
 * Middle-ground submission - mixed answers
 */
export const middleSubmission: SubmissionResponses = {
  submissionId: 'sub-middle',
  tenantId: 'tenant-001',
  scannerId: 'scanner-001',
  scannerVersion: '1.0.0',
  responses: [
    { questionId: 'q1', answer: 2 as AnswerValue },
    { questionId: 'q2', answer: 3 as AnswerValue },
    { questionId: 'q3', answer: 3 as AnswerValue },
    { questionId: 'q4', answer: 2 as AnswerValue },
    { questionId: 'q5', answer: 3 as AnswerValue },
  ],
  submittedAt: '2024-01-15T10:30:00Z',
};

/**
 * Empty scanner (no questions) - for edge case testing
 */
export const emptyScanner: ScannerStructure = {
  scannerId: 'scanner-empty',
  version: '1.0.0',
  questions: [],
  domains: [
    { id: 'health', formulaType: 'health', name: 'Health' },
  ],
  categories: [],
};

/**
 * Single question scanner - for minimal testing
 */
export const singleQuestionScanner: ScannerStructure = {
  scannerId: 'scanner-single',
  version: '1.0.0',
  questions: [
    { id: 'q1', categoryId: 'cat1', weight: 100, domainId: 'health' },
  ],
  domains: [
    { id: 'health', formulaType: 'health', name: 'Health' },
  ],
  categories: [
    { id: 'cat1', name: 'Category 1' },
  ],
};

/**
 * Scanner with different weight distributions
 */
export const variedWeightScanner: ScannerStructure = {
  scannerId: 'scanner-weights',
  version: '1.0.0',
  questions: [
    { id: 'q1', categoryId: 'cat1', weight: 10, domainId: 'health' },
    { id: 'q2', categoryId: 'cat1', weight: 20, domainId: 'health' },
    { id: 'q3', categoryId: 'cat1', weight: 70, domainId: 'health' },
  ],
  domains: [
    { id: 'health', formulaType: 'health', name: 'Health' },
  ],
  categories: [
    { id: 'cat1', name: 'Category 1' },
  ],
};

/**
 * Create a calculation input from scanner and submission
 */
export function createCalculationInput(
  scanner: ScannerStructure,
  submission: SubmissionResponses
): CalculationInput {
  return {
    scanner,
    submission,
    includeTraceability: true,
  };
}

/**
 * Pre-computed expected values for sample submission
 *
 * Health Domain (questions q1, q2, q3):
 * - Total weight: 30 + 20 + 50 = 100
 * - MPS = 100 × 4 = 400
 * - WRS: q1=4×30=120, q2=3×20=60, q3=2×50=100
 * - ΣWRS = 280
 * - Health Score = (280/400) × 100 = 70%
 *
 * Risk Domain (questions q4, q5):
 * - Total weight: 40 + 60 = 100
 * - MPS = 100 × 4 = 400
 * - WRS: q4=1×40=40, q5=2×60=120
 * - ΣWRS = 160
 * - Risk Score = (1 - 160/400) × 100 = 60%
 */
export const expectedSampleResults = {
  health: {
    sumWeightedScores: 280,
    maximumPossibleScore: 400,
    normalizedScore: 70,
    questionCount: 3,
  },
  risk: {
    sumWeightedScores: 160,
    maximumPossibleScore: 400,
    normalizedScore: 60,
    questionCount: 2,
  },
  overall: {
    totalWeightedScores: 440,
    totalMaximumPossibleScore: 800,
    overallScore: 66, // weighted average: (70×3 + 60×2) / 5 = 66
  },
};

/**
 * Pre-computed expected values for perfect submission
 *
 * All answers = 4
 * - Health: 100%
 * - Risk: 0%
 */
export const expectedPerfectResults = {
  health: {
    sumWeightedScores: 400,
    maximumPossibleScore: 400,
    normalizedScore: 100,
  },
  risk: {
    sumWeightedScores: 400,
    maximumPossibleScore: 400,
    normalizedScore: 0,
  },
};

/**
 * Pre-computed expected values for worst submission
 *
 * All answers = 1
 * - Health: 0%
 * - Risk: 100%
 */
export const expectedWorstResults = {
  health: {
    sumWeightedScores: 100,
    maximumPossibleScore: 400,
    normalizedScore: 0,
  },
  risk: {
    sumWeightedScores: 100,
    maximumPossibleScore: 400,
    normalizedScore: 100,
  },
};