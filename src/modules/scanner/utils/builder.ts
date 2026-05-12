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
