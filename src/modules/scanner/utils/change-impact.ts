/**
 * Scanner Change Impact Engine
 *
 * Classifies scanner changes into:
 * - SAFE: Non-semantic changes (typos, translations, order)
 * - ADDITIVE: Extensions that don't invalidate old submissions
 * - BREAKING: Semantic changes that affect scoring/analytics
 *
 * This is the core business logic for submission-aware editing.
 */

import type { Category, Question, ScannerVersion, Subdomain } from '../types';

export type ChangeImpactType = 'safe' | 'additive' | 'breaking';

export interface ChangeImpact {
  type: ChangeImpactType;
  severity: 'info' | 'warning' | 'blocking';
  code: string;
  message: string;
  path: string;
  affectedCount?: number;
}

export interface ChangeDetectionResult {
  hasChanges: boolean;
  impacts: ChangeImpact[];
  canSave: boolean;
  requiresDuplicate: boolean;
}

/**
 * Compare two question arrays and detect changes
 */
function detectQuestionChanges(
  before: Question[],
  after: Question[],
  subdomainPath: string
): ChangeImpact[] {
  const impacts: ChangeImpact[] = [];

  const beforeMap = new Map<string, Question>(before.map(q => [q.id, q]));
  const afterMap = new Map<string, Question>(after.map(q => [q.id, q]));

  // Check for deleted questions (BREAKING)
  for (const [id, beforeQ] of Array.from(beforeMap)) {
    if (!afterMap.has(id)) {
      impacts.push({
        type: 'breaking',
        severity: 'blocking',
        code: 'QUESTION_DELETED',
        message: `Question "${beforeQ.text.en}" has been deleted`,
        path: `${subdomainPath}.questions.${id}`,
        affectedCount: 1,
      });
    }
  }

  // Check for added questions (ADDITIVE)
  for (const [id, afterQ] of Array.from(afterMap)) {
    if (!beforeMap.has(id)) {
      impacts.push({
        type: 'additive',
        severity: 'info',
        code: 'QUESTION_ADDED',
        message: `New question "${afterQ.text.en}" added`,
        path: `${subdomainPath}.questions.${id}`,
      });
    }
  }

  // Check for modified questions
  for (const [id, beforeQ] of Array.from(beforeMap)) {
    const afterQ = afterMap.get(id);
    if (!afterQ) continue;

    // Check for score changes (BREAKING)
    for (const beforeOpt of beforeQ.options) {
      const afterOpt = afterQ.options.find(o => o.id === beforeOpt.id);
      if (afterOpt && beforeOpt.score !== afterOpt.score) {
        const beforeLabel = beforeOpt.label.en;
        impacts.push({
          type: 'breaking',
          severity: 'blocking',
          code: 'SCORE_CHANGED',
          message: `Score changed for answer "${beforeLabel}"`,
          path: `${subdomainPath}.questions.${id}.options.${beforeOpt.id}.score`,
        });
      }
    }

    // Check for answer option changes (BREAKING)
    const beforeOptIds = new Set(beforeQ.options.map(o => o.id));
    const afterOptIds = new Set(afterQ.options.map(o => o.id));

    for (const optId of Array.from(beforeOptIds)) {
      if (!afterOptIds.has(optId)) {
        impacts.push({
          type: 'breaking',
          severity: 'blocking',
          code: 'ANSWER_REMOVED',
          message: `Answer option removed from question "${beforeQ.text.en}"`,
          path: `${subdomainPath}.questions.${id}.options`,
        });
      }
    }

    // Check for question order changes (SAFE)
    const beforeOrder = beforeQ.order;
    const afterOrder = afterQ.order;
    if (beforeOrder !== afterOrder) {
      impacts.push({
        type: 'safe',
        severity: 'info',
        code: 'QUESTION_ORDER_CHANGED',
        message: `Question order changed`,
        path: `${subdomainPath}.questions.${id}.order`,
      });
    }

    // Check for text changes (SAFE)
    if (beforeQ.text.en !== afterQ.text.en) {
      impacts.push({
        type: 'safe',
        severity: 'info',
        code: 'QUESTION_TEXT_CHANGED',
        message: `Question text updated`,
        path: `${subdomainPath}.questions.${id}.text`,
      });
    }
  }

  return impacts;
}

/**
 * Compare two subdomain arrays and detect changes
 */
function detectSubdomainChanges(
  before: Subdomain[],
  after: Subdomain[],
  categoryPath: string
): ChangeImpact[] {
  const impacts: ChangeImpact[] = [];

  const beforeMap = new Map<string, Subdomain>(before.map(s => [s.id, s]));
  const afterMap = new Map<string, Subdomain>(after.map(s => [s.id, s]));

  // Check for deleted subdomains (BREAKING)
  for (const [id, beforeSub] of Array.from(beforeMap)) {
    if (!afterMap.has(id)) {
      impacts.push({
        type: 'breaking',
        severity: 'blocking',
        code: 'SUBDOMAIN_DELETED',
        message: `Subdomain "${beforeSub.name.en}" has been deleted`,
        path: `${categoryPath}.subdomains.${id}`,
        affectedCount: beforeSub.questions.length,
      });
    }
  }

  // Check for added subdomains (ADDITIVE)
  for (const [id, afterSub] of Array.from(afterMap)) {
    if (!beforeMap.has(id)) {
      impacts.push({
        type: 'additive',
        severity: 'info',
        code: 'SUBDOMAIN_ADDED',
        message: `New subdomain "${afterSub.name.en}" added`,
        path: `${categoryPath}.subdomains.${id}`,
      });
    }
  }

  // Check for order changes (SAFE)
  const beforeOrder = new Map<string, number>(before.map((s, i) => [s.id, i]));
  const afterOrder = new Map<string, number>(after.map((s, i) => [s.id, i]));

  for (const [id, beforeIdx] of Array.from(beforeOrder)) {
    const afterIdx = afterOrder.get(id);
    if (afterIdx !== undefined && beforeIdx !== afterIdx) {
      const subdomain = beforeMap.get(id)!;
      impacts.push({
        type: 'safe',
        severity: 'info',
        code: 'SUBDOMAIN_ORDER_CHANGED',
        message: `Subdomain order changed for "${subdomain.name.en}"`,
        path: `${categoryPath}.subdomains.${id}.order`,
      });
    }
  }

  // Compare questions within subdomains
  for (const [id, beforeSub] of Array.from(beforeMap)) {
    const afterSub = afterMap.get(id);
    if (!afterSub) continue;

    const questionImpacts = detectQuestionChanges(
      beforeSub.questions,
      afterSub.questions,
      `${categoryPath}.subdomains.${id}`
    );
    impacts.push(...questionImpacts);
  }

  return impacts;
}

/**
 * Compare two category arrays and detect changes
 */
function detectCategoryChanges(before: Category[], after: Category[]): ChangeImpact[] {
  const impacts: ChangeImpact[] = [];

  const beforeMap = new Map<string, Category>(before.map(c => [c.id, c]));
  const afterMap = new Map<string, Category>(after.map(c => [c.id, c]));

  // Check for deleted categories (BREAKING)
  for (const [id, beforeCat] of Array.from(beforeMap)) {
    if (!afterMap.has(id)) {
      const questionCount = beforeCat.subdomains.reduce(
        (sum: number, s) => sum + s.questions.length,
        0
      );
      impacts.push({
        type: 'breaking',
        severity: 'blocking',
        code: 'CATEGORY_DELETED',
        message: `Category "${beforeCat.name.en}" has been deleted`,
        path: `categories.${id}`,
        affectedCount: questionCount,
      });
    }
  }

  // Check for added categories (ADDITIVE - only if optional structure)
  for (const [id, afterCat] of Array.from(afterMap)) {
    if (!beforeMap.has(id)) {
      impacts.push({
        type: 'additive',
        severity: 'info',
        code: 'CATEGORY_ADDED',
        message: `New category "${afterCat.name.en}" added`,
        path: `categories.${id}`,
      });
    }
  }

  // Check for weight changes (BREAKING if submissions exist)
  for (const [id, beforeCat] of Array.from(beforeMap)) {
    const afterCat = afterMap.get(id);
    if (!afterCat) continue;

    if (beforeCat.weight !== afterCat.weight) {
      impacts.push({
        type: 'breaking',
        severity: 'blocking',
        code: 'CATEGORY_WEIGHT_CHANGED',
        message: `Category weight changed from ${beforeCat.weight}% to ${afterCat.weight}%`,
        path: `categories.${id}.weight`,
      });
    }

    // Check for order changes (SAFE)
    if (beforeCat.order !== afterCat.order) {
      impacts.push({
        type: 'safe',
        severity: 'info',
        code: 'CATEGORY_ORDER_CHANGED',
        message: `Category order changed`,
        path: `categories.${id}.order`,
      });
    }

    // Compare subdomains
    const subdomainImpacts = detectSubdomainChanges(
      beforeCat.subdomains,
      afterCat.subdomains,
      `categories.${id}`
    );
    impacts.push(...subdomainImpacts);
  }

  return impacts;
}

/**
 * Detect changes between two scanner versions
 */
export function detectScannerChanges(
  before: ScannerVersion | null,
  after: ScannerVersion
): ChangeDetectionResult {
  const impacts: ChangeImpact[] = [];

  // If no previous version, all changes are additive/safe (new creation)
  if (!before) {
    const questionCount = after.categories.reduce(
      (sum: number, cat) => sum + cat.subdomains.reduce((s: number, sub) => s + sub.questions.length, 0),
      0
    );
    return {
      hasChanges: true,
      impacts: [{
        type: 'additive',
        severity: 'info',
        code: 'NEW_SCANNER',
        message: `New scanner created with ${questionCount} questions`,
        path: 'root',
      }],
      canSave: true,
      requiresDuplicate: false,
    };
  }

  // Compare categories
  const categoryImpacts = detectCategoryChanges(before.categories, after.categories);
  impacts.push(...categoryImpacts);

  // Check for scanner-level metadata changes (SAFE)
  // These are handled separately in the editor

  // Determine if save is allowed
  const breakingImpacts = impacts.filter(i => i.type === 'breaking');
  const canSave = breakingImpacts.length === 0;
  const requiresDuplicate = breakingImpacts.length > 0;

  return {
    hasChanges: impacts.length > 0,
    impacts,
    canSave,
    requiresDuplicate,
  };
}

/**
 * Get a summary of change types for UI display
 */
export function getChangeTypeSummary(impacts: ChangeImpact[]): {
  safe: number;
  additive: number;
  breaking: number;
} {
  return {
    safe: impacts.filter(i => i.type === 'safe').length,
    additive: impacts.filter(i => i.type === 'additive').length,
    breaking: impacts.filter(i => i.type === 'breaking').length,
  };
}

/**
 * Check if scanner has any responses that would be affected by breaking changes
 */
export function checkSubmissionProtection(
  responseCount: number,
  impacts: ChangeImpact[]
): {
  protected: boolean;
  reason?: string;
  blockingImpacts: ChangeImpact[];
} {
  if (responseCount === 0) {
    return { protected: false, blockingImpacts: [] };
  }

  const breakingImpacts = impacts.filter(i => i.type === 'breaking');

  if (breakingImpacts.length > 0) {
    return {
      protected: true,
      reason: `This scanner has ${responseCount} submission(s). Breaking changes are not allowed.`,
      blockingImpacts: breakingImpacts,
    };
  }

  return { protected: false, blockingImpacts: [] };
}

/**
 * Check if saving would be blocked due to breaking changes
 * Wrapper for easier integration with UI components
 */
export function checkSaveProtection(
  responseCount: number,
  impacts: ChangeImpact[]
): { blocked: boolean; message?: string } {
  const protection = checkSubmissionProtection(responseCount, impacts);

  if (protection.protected) {
    return {
      blocked: true,
      message: protection.reason,
    };
  }

  return { blocked: false };
}