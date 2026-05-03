/**
 * Shared scanner draft builders and immutable helpers.
 */

import { Category, LocalizedText, Question, Subdomain } from '../types';

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
  return [1, 2, 3, 4, 5].map((slot) => {
    const id = createId('category');
    return {
      id,
      slot: slot as Category['slot'],
      name: emptyText(),
      polarity: 'positive',
      weight: 0,
      subdomains: [createEmptySubdomain(id)],
    };
  });
}
