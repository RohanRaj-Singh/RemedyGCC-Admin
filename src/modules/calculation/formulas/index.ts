/**
 * Formula Registry
 *
 * Central registry for formula normalizers.
 * Provides extensibility for future formula types without rewriting the engine.
 */

import { normalizeHealthScore, normalizeRiskScore, getFormulaNormalizer } from '../normalizers';
import type { FormulaType, FormulaRegistry, FormulaNormalizer } from '../contracts/types';

/**
 * The canonical formula registry
 * Maps formula type names to their normalizer functions
 */
export const formulaRegistry: FormulaRegistry = {
  health: normalizeHealthScore,
  risk: normalizeRiskScore,
};

/**
 * Get a formula normalizer by type
 *
 * @param formulaType - The type of formula ('health' or 'risk')
 * @returns The normalizer function
 * @throws Error if formula type not found
 */
export function getFormula(formulaType: FormulaType): FormulaNormalizer {
  const formula = formulaRegistry[formulaType];
  if (!formula) {
    throw new Error(`Formula not registered: ${formulaType}`);
  }
  return formula;
}

/**
 * Check if a formula type is registered
 *
 * @param formulaType - Formula type to check
 * @returns True if registered
 */
export function hasFormula(formulaType: string): boolean {
  return formulaType in formulaRegistry;
}

/**
 * Get all registered formula types
 *
 * @returns Array of registered formula type names
 */
export function getRegisteredFormulas(): FormulaType[] {
  return Object.keys(formulaRegistry) as FormulaType[];
}

// Re-export for convenience
export { getFormulaNormalizer, normalizeHealthScore, normalizeRiskScore };