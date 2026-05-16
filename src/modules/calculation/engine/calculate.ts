/**
 * Calculation Engine - Core Functions
 *
 * Pure, deterministic calculation functions for the scoring system.
 * No side effects, no database access, no state management.
 */

import type {
  AnswerValue,
  QuestionWeight,
  QuestionId,
  DomainId,
  FormulaType,
  CalculationInput,
  WeightedQuestionResult,
  DomainCalculationResult,
  SubmissionCalculationResult,
  ValidationResult,
  CalculationError,
  DomainDefinition,
  QuestionDefinition,
  ResponseAnswer,
} from '../contracts/types';
import { getFormula } from '../formulas';
import { roundScore, isValidScore } from '../normalizers';

/**
 * Constants
 */
const MAX_ANSWER_VALUE = 4;
const MIN_ANSWER_VALUE = 1;
const ENGINE_VERSION = '1.0.0';

/**
 * Calculate Weighted Raw Score (WRS) for a single question
 *
 * Formula: WRS = RawScore × QuestionWeight
 *
 * @param answer - Respondent's answer (1-4)
 * @param weight - Question weight (0-100)
 * @returns Weighted score
 */
export function calculateWeightedQuestionScore(
  answer: AnswerValue,
  weight: QuestionWeight
): number {
  // Validate inputs
  if (answer < MIN_ANSWER_VALUE || answer > MAX_ANSWER_VALUE) {
    throw new Error(`Invalid answer value: ${answer}. Must be between 1 and 4.`);
  }

  if (weight < 0 || weight > 100 || !isFinite(weight)) {
    throw new Error(`Invalid weight: ${weight}. Must be between 0 and 100.`);
  }

  // Calculate weighted score
  return answer * weight;
}

/**
 * Create a weighted question result entry
 *
 * @param questionId - Question identifier
 * @param domainId - Domain identifier
 * @param answer - Answer value
 * @param weight - Question weight
 * @returns WeightedQuestionResult
 */
export function createWeightedQuestionResult(
  questionId: QuestionId,
  domainId: DomainId,
  answer: AnswerValue,
  weight: QuestionWeight
): WeightedQuestionResult {
  return {
    questionId,
    domainId,
    rawScore: answer,
    weight,
    weightedScore: calculateWeightedQuestionScore(answer, weight),
  };
}

/**
 * Calculate Maximum Possible Score (MPS) for a set of questions
 *
 * Formula: MPS = Σ(question weights) × 4
 *
 * @param weights - Array of question weights
 * @returns Maximum possible score
 */
export function calculateMaximumPossibleScore(weights: QuestionWeight[]): number {
  const totalWeight = weights.reduce((sum, w) => sum + (w || 0), 0);
  return totalWeight * MAX_ANSWER_VALUE;
}

/**
 * Calculate domain-level score
 *
 * @param domainId - Domain identifier
 * @param domainDefinition - Domain metadata
 * @param questionResults - Array of weighted question results for this domain
 * @returns DomainCalculationResult
 */
export function calculateDomainScore(
  domainId: DomainId,
  domainDefinition: DomainDefinition,
  questionResults: WeightedQuestionResult[]
): DomainCalculationResult {
  // Calculate sum of weighted scores (ΣWRS)
  const sumWeightedScores = questionResults.reduce(
    (sum, result) => sum + result.weightedScore,
    0
  );

  // Calculate maximum possible score (MPS)
  const weights = questionResults.map((r) => r.weight);
  const maximumPossibleScore = calculateMaximumPossibleScore(weights);

  // Get the appropriate formula normalizer
  const normalizer = getFormula(domainDefinition.formulaType);

  // Calculate normalized score
  const normalizedScore = normalizer(sumWeightedScores, maximumPossibleScore);

  return {
    domainId,
    domainName: domainDefinition.name,
    formulaType: domainDefinition.formulaType,
    weightedScores: questionResults,
    sumWeightedScores: roundScore(sumWeightedScores),
    maximumPossibleScore: roundScore(maximumPossibleScore),
    normalizedScore: roundScore(normalizedScore),
    questionCount: questionResults.length,
  };
}

/**
 * Build a map of domain definitions for quick lookup
 */
function buildDomainMap(
  domains: DomainDefinition[]
): Map<DomainId, DomainDefinition> {
  const domainMap = new Map<DomainId, DomainDefinition>();
  domains.forEach((domain) => {
    domainMap.set(domain.id, domain);
  });
  return domainMap;
}

/**
 * Build a map of question definitions for quick lookup
 */
function buildQuestionMap(
  questions: QuestionDefinition[]
): Map<QuestionId, QuestionDefinition> {
  const questionMap = new Map<QuestionId, QuestionDefinition>();
  questions.forEach((q) => {
    questionMap.set(q.id, q);
  });
  return questionMap;
}

/**
 * Validate calculation input
 *
 * @param input - Calculation input to validate
 * @returns Validation result with any errors
 */
export function validateInput(input: CalculationInput): ValidationResult {
  const errors: CalculationError[] = [];

  // Validate scanner structure
  if (!input.scanner) {
    errors.push({
      code: 'MISSING_RESPONSE',
      message: 'Scanner structure is required',
    });
    return { valid: false, errors };
  }

  // Validate scanner questions
  if (!input.scanner.questions || input.scanner.questions.length === 0) {
    errors.push({
      code: 'MISSING_RESPONSE',
      message: 'Scanner must have at least one question',
    });
  }

  // Validate scanner domains
  if (!input.scanner.domains || input.scanner.domains.length === 0) {
    errors.push({
      code: 'MISSING_RESPONSE',
      message: 'Scanner must have at least one domain',
    });
  }

  // Validate submission
  if (!input.submission) {
    errors.push({
      code: 'MISSING_RESPONSE',
      message: 'Submission is required',
    });
    return { valid: false, errors };
  }

  // Validate responses
  if (!input.submission.responses || input.submission.responses.length === 0) {
    errors.push({
      code: 'MISSING_RESPONSE',
      message: 'Submission must have at least one response',
    });
  }

  // Validate individual responses
  if (input.submission.responses) {
    const questionMap = buildQuestionMap(input.scanner.questions);

    input.submission.responses.forEach((response) => {
      // Check answer value is valid
      if (response.answer < MIN_ANSWER_VALUE || response.answer > MAX_ANSWER_VALUE) {
        errors.push({
          code: 'INVALID_ANSWER',
          message: `Invalid answer for question ${response.questionId}: ${response.answer}`,
          context: { questionId: response.questionId, answer: response.answer },
        });
      }

      // Check question exists in scanner
      const question = questionMap.get(response.questionId);
      if (!question) {
        errors.push({
          code: 'MISSING_RESPONSE',
          message: `Question ${response.questionId} not found in scanner`,
          context: { questionId: response.questionId },
        });
      }
    });
  }

  // Validate domain formula types
  if (input.scanner.domains) {
    const validFormulaTypes = ['health', 'risk'];
    input.scanner.domains.forEach((domain) => {
      if (!validFormulaTypes.includes(domain.formulaType)) {
        errors.push({
          code: 'INVALID_FORMULA',
          message: `Invalid formula type for domain ${domain.id}: ${domain.formulaType}`,
          context: { domainId: domain.id, formulaType: domain.formulaType },
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Main calculation function - calculates all domain scores for a submission
 *
 * This is the primary entry point for the calculation engine.
 * All calculations are pure and deterministic.
 *
 * @param input - CalculationInput with scanner structure and submission responses
 * @returns SubmissionCalculationResult with all domain scores and traceability
 * @throws Error if input is invalid
 */
export function calculateSubmission(input: CalculationInput): SubmissionCalculationResult {
  // Validate input first
  const validation = validateInput(input);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e) => e.message).join('; ');
    throw new Error(`Invalid calculation input: ${errorMessages}`);
  }

  const { scanner, submission } = input;
  const includeTraceability = input.includeTraceability ?? true;

  // Build lookup maps for efficiency
  const domainMap = buildDomainMap(scanner.domains);
  const questionMap = buildQuestionMap(scanner.questions);

  // Group responses by domain
  const domainResponses = new Map<DomainId, ResponseAnswer[]>();

  submission.responses.forEach((response) => {
    const question = questionMap.get(response.questionId);
    if (question) {
      const domainId = question.domainId;
      if (!domainResponses.has(domainId)) {
        domainResponses.set(domainId, []);
      }
      domainResponses.get(domainId)!.push(response);
    }
  });

  // Calculate score for each domain
  const domainResults: DomainCalculationResult[] = [];

  scanner.domains.forEach((domain) => {
    const responses = domainResponses.get(domain.id) || [];

    // Calculate weighted scores for each question in this domain
    const questionResults: WeightedQuestionResult[] = responses.map((response) => {
      const question = questionMap.get(response.questionId)!;
      return createWeightedQuestionResult(
        response.questionId,
        question.domainId,
        response.answer,
        question.weight
      );
    });

    // Calculate domain score
    const domainResult = calculateDomainScore(domain.id, domain, questionResults);
    domainResults.push(domainResult);
  });

  // Calculate totals
  const totalWeightedScores = domainResults.reduce(
    (sum, d) => sum + d.sumWeightedScores,
    0
  );
  const totalMaximumPossibleScore = domainResults.reduce(
    (sum, d) => sum + d.maximumPossibleScore,
    0
  );

  // Calculate overall score (weighted average by question count)
  const totalQuestions = domainResults.reduce((sum, d) => sum + d.questionCount, 0);
  const overallScore = domainResults.reduce((sum, d) => {
    const weight = d.questionCount / totalQuestions;
    return sum + d.normalizedScore * weight;
  }, 0);

  return {
    submissionId: submission.submissionId,
    tenantId: submission.tenantId,
    scannerId: submission.scannerId,
    scannerVersion: submission.scannerVersion,
    submittedAt: submission.submittedAt,
    domainResults,
    totalWeightedScores: roundScore(totalWeightedScores),
    totalMaximumPossibleScore: roundScore(totalMaximumPossibleScore),
    overallScore: roundScore(overallScore),
    calculatedAt: new Date().toISOString(),
    calculationVersion: ENGINE_VERSION,
  };
}

/**
 * Calculate just one domain's score (useful for partial calculations)
 *
 * @param domainId - Domain to calculate
 * @param domainDefinition - Domain metadata
 * @param responses - Responses for questions in this domain
 * @param questions - All questions from scanner
 * @returns DomainCalculationResult
 */
export function calculateSingleDomain(
  domainId: DomainId,
  domainDefinition: DomainDefinition,
  responses: ResponseAnswer[],
  questions: QuestionDefinition[]
): DomainCalculationResult {
  // Filter questions for this domain
  const domainQuestions = questions.filter((q) => q.domainId === domainId);

  // Build question lookup
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Calculate weighted scores
  const questionResults: WeightedQuestionResult[] = responses
    .filter((r) => {
      const q = questionMap.get(r.questionId);
      return q && q.domainId === domainId;
    })
    .map((response) => {
      const question = questionMap.get(response.questionId)!;
      return createWeightedQuestionResult(
        response.questionId,
        question.domainId,
        response.answer,
        question.weight
      );
    });

  return calculateDomainScore(domainId, domainDefinition, questionResults);
}

/**
 * Get a specific domain result from submission results
 *
 * @param results - Submission calculation results
 * @param domainId - Domain ID to find
 * @returns DomainCalculationResult or undefined
 */
export function getDomainResult(
  results: SubmissionCalculationResult,
  domainId: DomainId
): DomainCalculationResult | undefined {
  return results.domainResults.find((d) => d.domainId === domainId);
}

/**
 * Export engine version
 */
export const engineVersion = ENGINE_VERSION;