/**
 * Weight Utilities
 * Functions for calculating and validating question weights
 */

import { Question, WeightValidation } from '../types';

const MAX_WEIGHT = 100;

/**
 * Calculate total weight from questions
 */
export function calculateTotalWeight(questions: Question[]): number {
  return questions.reduce((sum, q) => sum + q.weight, 0);
}

/**
 * Get remaining weight available
 */
export function getRemainingWeight(questions: Question[]): number {
  return MAX_WEIGHT - calculateTotalWeight(questions);
}

/**
 * Validate weight configuration
 */
export function validateWeights(questions: Question[]): WeightValidation {
  const total = calculateTotalWeight(questions);
  const remaining = MAX_WEIGHT - total;

  const validation: WeightValidation = {
    isValid: total === MAX_WEIGHT,
    total,
    remaining,
    hasError: total > MAX_WEIGHT,
    hasWarning: total < MAX_WEIGHT && total > 0,
  };

  if (total > MAX_WEIGHT) {
    validation.error = `Total weight (${total}) exceeds maximum of ${MAX_WEIGHT}`;
  } else if (total < MAX_WEIGHT && total > 0) {
    validation.warning = `Total weight (${total}) is below maximum. Add ${remaining} more to reach 100.`;
  } else if (total === 0) {
    validation.warning = 'No weights assigned yet';
  }

  return validation;
}

/**
 * Distribute weight equally among questions
 */
export function distributeEqually(questions: Question[]): Question[] {
  if (questions.length === 0) return [];

  const equalWeight = Math.floor(MAX_WEIGHT / questions.length);
  const remainder = MAX_WEIGHT - equalWeight * questions.length;

  return questions.map((q, index) => ({
    ...q,
    weight: equalWeight + (index < remainder ? 1 : 0),
  }));
}

/**
 * Auto-balance remaining weight to a new question
 */
export function autoBalanceRemaining(questions: Question[]): number {
  return getRemainingWeight(questions);
}

/**
 * Generate a unique question ID
 */
export function generateQuestionId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty question with auto-assigned weight
 */
export function createNewQuestion(questions: Question[]): Question {
  const remainingWeight = getRemainingWeight(questions);
  
  return {
    id: generateQuestionId(),
    text: '',
    options: ['Option 1', 'Option 2'],
    weight: remainingWeight > 0 ? remainingWeight : 0,
  };
}

/**
 * Update question weight while maintaining validation
 */
export function updateQuestionWeight(
  questions: Question[],
  questionId: string,
  newWeight: number
): Question[] {
  const clampedWeight = Math.max(0, Math.min(MAX_WEIGHT, newWeight));
  
  return questions.map(q => 
    q.id === questionId ? { ...q, weight: clampedWeight } : q
  );
}
