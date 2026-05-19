/**
 * Presentation helpers for scanner builder UI.
 * These do not alter validation or persistence logic.
 */

import { Category, Question, Subdomain } from '../types';

export const WEIGHT_EPSILON = 0.001;

export function normalizeWeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

// Use a small tolerance so valid decimal totals are not rejected by floating point drift.
export function areWeightsEqual(total: number, target: number): boolean {
  return Math.abs(normalizeWeight(total) - normalizeWeight(target)) < WEIGHT_EPSILON;
}

export function sumWeights(items: Array<{ weight?: number }>): number {
  return normalizeWeight(items.reduce((total, item) => total + (item.weight || 0), 0));
}

export function getWeightBalance(total: number, target: number) {
  const normalizedTotal = normalizeWeight(total);
  const normalizedTarget = normalizeWeight(target);
  const isExact = areWeightsEqual(normalizedTotal, normalizedTarget);
  const delta = isExact ? 0 : normalizeWeight(normalizedTarget - normalizedTotal);

  return {
    total: normalizedTotal,
    target: normalizedTarget,
    remaining: delta > 0 ? delta : 0,
    overflow: delta < 0 ? Math.abs(delta) : 0,
    isExact,
  };
}

export function getQuestionCount(category: Category): number {
  return category.subdomains.reduce(
    (total, subdomain) => total + subdomain.questions.length,
    0
  );
}

export function getSubdomainMetrics(subdomain: Subdomain) {
  const questionWeightTotal = sumWeights(subdomain.questions);
  const followUpCount = subdomain.questions.filter((question) => question.kind === 'follow-up').length;

  return {
    questionWeightTotal,
    followUpCount,
    questionCount: subdomain.questions.length,
    balance: getWeightBalance(questionWeightTotal, subdomain.weight),
  };
}

export function getCategoryMetrics(category: Category) {
  const subdomainWeightTotal = sumWeights(category.subdomains);
  const questionCount = getQuestionCount(category);

  return {
    subdomainWeightTotal,
    questionCount,
    subdomainCount: category.subdomains.length,
    balance: getWeightBalance(subdomainWeightTotal, category.weight),
  };
}

export function getScannerCounts(categories: Category[]) {
  const categoryCount = categories.length;
  const subdomainCount = categories.reduce(
    (total, category) => total + category.subdomains.length,
    0
  );
  const questionCount = categories.reduce(
    (total, category) =>
      total + category.subdomains.reduce((subTotal, subdomain) => subTotal + subdomain.questions.length, 0),
    0
  );
  const followUpCount = categories.reduce(
    (total, category) =>
      total + category.subdomains.reduce(
        (subTotal, subdomain) =>
          subTotal + subdomain.questions.filter((question) => question.kind === 'follow-up').length,
        0
      ),
    0
  );

  return {
    categoryCount,
    subdomainCount,
    questionCount,
    followUpCount,
  };
}

export function getQuestionOptionCount(question: Question): number {
  return question.options.length;
}
