/**
 * Shared scanner draft builders and immutable helpers.
 */

import { Category, LocalizedText, Question, Subdomain } from '../types';
import { FIXED_CATEGORIES } from '../constants/categories';

export function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyText(): LocalizedText {
  return { en: '', ar: '' };
}

export function createEmptyOption(order: number) {
  return {
    id: createId('option'),
    order,
    label: emptyText(),
    score: 0,
  };
}

export function createEmptyQuestion(subdomainId: string, order: number): Question {
  return {
    id: createId('question'),
    order,
    subdomainId,
    text: emptyText(),
    weight: 0,
    kind: 'primary',
    options: [createEmptyOption(1), createEmptyOption(2)],
  };
}

export function createEmptySubdomain(categoryId: string, order: number): Subdomain {
  const id = createId('subdomain');
  return {
    id,
    order,
    categoryId,
    name: emptyText(),
    weight: 0,
    questions: [createEmptyQuestion(id, 1)],
  };
}

function normalizeQuestionOptions(options: Question['options']): Question['options'] {
  return options.map((option, index) => ({
    ...option,
    order: index + 1,
  }));
}

function normalizeQuestions(subdomainId: string, questions: Question[]): Question[] {
  return questions.map((question, index) => ({
    ...question,
    order: index + 1,
    subdomainId,
    options: normalizeQuestionOptions(question.options),
  }));
}

function normalizeSubdomains(categoryId: string, subdomains: Subdomain[]): Subdomain[] {
  return subdomains.map((subdomain, index) => ({
    ...subdomain,
    order: index + 1,
    categoryId,
    questions: normalizeQuestions(subdomain.id, subdomain.questions),
  }));
}

// The builder UI uses array position as the source of truth, so we rewrite
// derived order fields after add/remove/reorder operations to keep validation in sync.
export function normalizeCategories(categories: Category[]): Category[] {
  return categories.map((category, index) => ({
    ...category,
    order: index + 1,
    subdomains: normalizeSubdomains(category.id, category.subdomains),
  }));
}

export function createDefaultCategories(): Category[] {
  return FIXED_CATEGORIES.map((name, index) => {
    const slot = (index + 1) as Category['slot'];
    const id = createId('category');
    return {
      id,
      order: index + 1,
      slot,
      name: { en: name, ar: name },
      weight: 0,
      subdomains: [createEmptySubdomain(id, 1)],
    };
  });
}
