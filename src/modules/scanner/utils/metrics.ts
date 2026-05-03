/**
 * Presentation helpers for scanner builder UI.
 * These do not alter validation or persistence logic.
 */

import { Category, Question, Subdomain } from '../types';

export function sumWeights(items: Array<{ weight: number }>): number {
  return items.reduce((total, item) => total + item.weight, 0);
}

export function getWeightBalance(total: number, target: number) {
  const delta = target - total;

  return {
    total,
    target,
    remaining: delta > 0 ? delta : 0,
    overflow: delta < 0 ? Math.abs(delta) : 0,
    isExact: delta === 0,
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
  const followUpCount = subdomain.questions.filter((question) => question.isFollowUp).length;

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
          subTotal + subdomain.questions.filter((question) => question.isFollowUp).length,
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
