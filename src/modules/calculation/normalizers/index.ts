/**
 * Formula Normalizers
 *
 * Pure functions that transform weighted scores into normalized percentages.
 *
 * Core Formulas:
 * - Health: (ΣWRS / MPS) × 100  → Higher = Healthier
 * - Risk: (1 - ΣWRS / MPS) × 100  → Higher = Higher Risk
 *
 * Answer Scale: 4 = healthiest, 1 = highest risk
 * No inversion logic required - the scale already maps correctly.
 */

import type { FormulaNormalizer } from '../contracts/types';

/**
 * Health Score Normalizer
 *
 * Formula: HealthScore = (ΣWRS / MPS) × 100
 *
 * Returns a percentage where:
 * - 100% = maximum health (all questions answered with 4)
 * - 0% = minimum health (all questions answered with 1)
 *
 * @param sumWeightedScores - Sum of Weighted Raw Scores (ΣWRS)
 * @param maximumPossibleScore - Maximum Possible Score (MPS)
 * @returns Normalized health percentage (0-100)
 */
export function normalizeHealthScore(
  sumWeightedScores: number,
  maximumPossibleScore: number
): number {
  // Handle edge case: no questions or invalid MPS
  if (maximumPossibleScore === 0 || !isFinite(maximumPossibleScore)) {
    return 0;
  }

  // Calculate normalized score
  const ratio = sumWeightedScores / maximumPossibleScore;

  // Clamp to valid range and convert to percentage
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return clampedRatio * 100;
}

/**
 * Risk Score Normalizer
 *
 * Formula: RiskScore = (1 - ΣWRS / MPS) × 100
 *               = ((MPS - ΣWRS) / MPS) × 100
 *
 * Returns a percentage where:
 * - 0% = no risk (all questions answered with 4)
 * - 100% = maximum risk (all questions answered with 1)
 *
 * @param sumWeightedScores - Sum of Weighted Raw Scores (ΣWRS)
 * @param maximumPossibleScore - Maximum Possible Score (MPS)
 * @returns Normalized risk percentage (0-100)
 */
export function normalizeRiskScore(
  sumWeightedScores: number,
  maximumPossibleScore: number
): number {
  // Handle edge case: no questions or invalid MPS
  if (maximumPossibleScore === 0 || !isFinite(maximumPossibleScore)) {
    return 0;
  }

  // Calculate risk ratio (inverse of health)
  const riskRatio = 1 - (sumWeightedScores / maximumPossibleScore);

  // Clamp to valid range and convert to percentage
  const clampedRatio = Math.max(0, Math.min(1, riskRatio));
  return clampedRatio * 100;
}

/**
 * Factory function to create a formula normalizer by type
 *
 * @param formulaType - 'health' or 'risk'
 * @returns The appropriate normalizer function
 * @throws Error if formula type is unknown
 */
export function getFormulaNormalizer(
  formulaType: 'health' | 'risk'
): FormulaNormalizer {
  switch (formulaType) {
    case 'health':
      return normalizeHealthScore;
    case 'risk':
      return normalizeRiskScore;
    default:
      throw new Error(`Unknown formula type: ${formulaType}`);
  }
}

/**
 * Round a score to a specific number of decimal places
 *
 * @param score - Raw score
 * @param decimals - Number of decimal places
 * @returns Rounded score
 */
export function roundScore(score: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(score * multiplier) / multiplier;
}

/**
 * Validate a score is within valid range
 *
 * @param score - Score to validate
 * @returns True if score is between 0 and 100
 */
export function isValidScore(score: number): boolean {
  return isFinite(score) && score >= 0 && score <= 100;
}