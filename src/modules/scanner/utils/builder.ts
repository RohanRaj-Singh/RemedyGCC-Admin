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

export function createEmptyOption() {
  return {
    id: createId('option'),
    label: emptyText(),
    scoreValue: 0,
  };
}

export function createEmptyQuestion(subdomainId: string): Question {
  return {
    id: createId('question'),
    subdomainId,
    text: emptyText(),
    weight: 0,
    isFollowUp: false,
    options: [createEmptyOption(), createEmptyOption()],
  };
}

export function createEmptySubdomain(categoryId: string): Subdomain {
  const id = createId('subdomain');
  return {
    id,
    categoryId,
    name: emptyText(),
    weight: 0,
    questions: [createEmptyQuestion(id)],
  };
}

export function createDefaultCategories(): Category[] {
  return FIXED_CATEGORIES.map((name, index) => {
    const slot = (index + 1) as Category['slot'];
    const id = createId('category');
    return {
      id,
      slot,
      name: { en: name, ar: name },
      polarity: 'positive',
      weight: 0,
      subdomains: [createEmptySubdomain(id)],
    };
  });
}
