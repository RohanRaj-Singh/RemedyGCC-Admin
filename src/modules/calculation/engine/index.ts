/**
 * Calculation Engine - Public API
 */

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
} from './calculate';

export type {
  CalculationInput,
  SubmissionCalculationResult,
  DomainCalculationResult,
  WeightedQuestionResult,
  ValidationResult,
  CalculationError,
} from '../contracts/types';