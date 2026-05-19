/**
 * Scanner validation engine.
 * Shared by draft save flows and publish flows.
 * Scanner validation is now decoupled from Attribute Template - tenant handles composition validation.
 */

import {
  Category,
  LocalizedText,
  Question,
  SaveScannerDraftDto,
  ScannerVersion,
  Subdomain,
  ValidationIssue,
  ValidationResult,
  ValidationIssueSeverity,
} from '../types';
import { areWeightsEqual, normalizeWeight, sumWeights } from './metrics';

function pushIssue(issues: ValidationIssue[], issue: Omit<ValidationIssue, 'id'>) {
  issues.push({
    ...issue,
    id: `${issue.code}-${issue.questionId || issue.subdomainId || issue.categoryId || issue.path}`
  });
}

function isLocalizedTextComplete(value?: LocalizedText): boolean {
  return Boolean(value?.en.trim() && value?.ar.trim());
}

function validateLocalizedText(
  issues: ValidationIssue[],
  value: LocalizedText | undefined,
  message: string,
  level: ValidationIssue['level'],
  severity: ValidationIssueSeverity,
  path: string,
  context: {
    categoryId?: string;
    categoryName?: string;
    subdomainId?: string;
    subdomainName?: string;
    questionId?: string;
    questionText?: string;
    answerId?: string;
    answerLabel?: string;
  }
) {
  if (!isLocalizedTextComplete(value)) {
    pushIssue(issues, {
      code: 'MISSING_TRANSLATION',
      level,
      severity,
      path,
      message,
      blocking: severity === 'error',
      ...context,
    });
  }
}

function validateQuestion(
  question: Question,
  subdomain: Subdomain,
  category: Category,
  issues: ValidationIssue[]
) {
  const context = {
    categoryId: category.id,
    categoryName: category.name.en || 'Untitled Category',
    subdomainId: subdomain.id,
    subdomainName: subdomain.name.en || 'Untitled Subdomain',
    questionId: question.id,
    questionText: question.text.en || 'Untitled Question',
  };

  validateLocalizedText(
    issues,
    question.text,
    'Question text is required in English and Arabic.',
    'question',
    'error',
    `question.${question.id}.text`,
    context
  );

  if (question.options.length < 2) {
    pushIssue(issues, {
      code: 'QUESTION_OPTIONS_MINIMUM',
      level: 'question',
      severity: 'error',
      path: `question.${question.id}.options`,
      message: 'Questions must have at least two multiple-choice options.',
      blocking: true,
      ...context,
    });
  }

  question.options.forEach((option, index) => {
    const optContext = { ...context, answerId: option.id, answerLabel: option.label.en || `Option ${index + 1}` };
    
    if (option.order !== index + 1) {
      pushIssue(issues, {
        code: 'QUESTION_OPTION_ORDER_INVALID',
        level: 'question',
        severity: 'error',
        path: `question.${question.id}.option.${option.id}.order`,
        message: 'Option order must be sequential starting from 1.',
        blocking: true,
        ...optContext,
      });
    }

    if (typeof option.score !== 'number' || isNaN(option.score)) {
      pushIssue(issues, {
        code: 'QUESTION_OPTION_SCORE_INVALID',
        level: 'question',
        severity: 'error',
        path: `question.${question.id}.option.${option.id}.score`,
        message: 'Every answer option must have an explicit numeric score.',
        blocking: true,
        ...optContext,
      });
    }

    validateLocalizedText(
      issues,
      option.label,
      'Every answer option is required in English and Arabic.',
      'question',
      'error',
      `question.${question.id}.option.${option.id}.label`,
      optContext
    );
  });

  if (!question.weight || question.weight <= 0) {
    pushIssue(issues, {
      code: 'QUESTION_WEIGHT_REQUIRED',
      level: 'question',
      severity: question.kind === 'primary' ? 'error' : 'info',
      path: `question.${question.id}.weight`,
      message: question.kind === 'primary' 
        ? 'Primary question weight must be greater than zero.'
        : 'Diagnostic follow-ups typically do not need weights.',
      blocking: question.kind === 'primary',
      ...context,
    });
  }
}

function validateSubdomain(subdomain: Subdomain, category: Category, issues: ValidationIssue[]) {
  const context = {
    categoryId: category.id,
    categoryName: category.name.en || 'Untitled Category',
    subdomainId: subdomain.id,
    subdomainName: subdomain.name.en || 'Untitled Subdomain',
  };

  validateLocalizedText(
    issues,
    subdomain.name,
    'Subdomain name is required in English and Arabic.',
    'subdomain',
    'error',
    `subdomain.${subdomain.id}.name`,
    context
  );

  if (subdomain.questions.length === 0) {
    pushIssue(issues, {
      code: 'SUBDOMAIN_QUESTION_REQUIRED',
      level: 'subdomain',
      severity: 'error',
      path: `subdomain.${subdomain.id}.questions`,
      message: 'Each subdomain must contain at least one question.',
      blocking: true,
      ...context,
    });
  }

  const questionWeightTotal = sumWeights(subdomain.questions);
  // Normalize and compare with a small tolerance so valid decimals do not fail due to JS float math.
  if (!areWeightsEqual(questionWeightTotal, subdomain.weight)) {
    pushIssue(issues, {
      code: 'SUBDOMAIN_WEIGHT_MISMATCH',
      level: 'subdomain',
      severity: 'error',
      path: `subdomain.${subdomain.id}.weight`,
      message: `Question weights must total ${normalizeWeight(subdomain.weight)} for this subdomain. Current total is ${questionWeightTotal}.`,
      blocking: true,
      ...context,
    });
  }

  subdomain.questions.forEach((question, index) => {
    if (question.order !== index + 1) {
      pushIssue(issues, {
        code: 'SUBDOMAIN_QUESTION_ORDER_INVALID',
        level: 'subdomain',
        severity: 'error',
        path: `subdomain.${subdomain.id}.question.${question.id}.order`,
        message: 'Question order must be sequential starting from 1.',
        blocking: true,
        ...context,
        questionId: question.id,
        questionText: question.text.en,
      });
    }
    validateQuestion(question, subdomain, category, issues);
  });
}

function validateCategory(category: Category, issues: ValidationIssue[]) {
  const context = {
    categoryId: category.id,
    categoryName: category.name.en || 'Untitled Category',
  };

  validateLocalizedText(
    issues,
    category.name,
    'Category name is required in English and Arabic.',
    'category',
    'error',
    `category.${category.id}.name`,
    context
  );

  if (category.subdomains.length === 0) {
    pushIssue(issues, {
      code: 'CATEGORY_SUBDOMAIN_REQUIRED',
      level: 'category',
      severity: 'error',
      path: `category.${category.id}.subdomains`,
      message: 'Each category must contain at least one subdomain.',
      blocking: true,
      ...context,
    });
  }

  const subdomainWeightTotal = sumWeights(category.subdomains);
  if (!areWeightsEqual(subdomainWeightTotal, category.weight)) {
    pushIssue(issues, {
      code: 'CATEGORY_WEIGHT_MISMATCH',
      level: 'category',
      severity: 'error',
      path: `category.${category.id}.weight`,
      message: `Subdomain weights must total ${normalizeWeight(category.weight)} for this category. Current total is ${subdomainWeightTotal}.`,
      blocking: true,
      ...context,
    });
  }

  category.subdomains.forEach((subdomain, index) => {
    if (subdomain.order !== index + 1) {
      pushIssue(issues, {
        code: 'CATEGORY_SUBDOMAIN_ORDER_INVALID',
        level: 'category',
        severity: 'error',
        path: `category.${category.id}.subdomain.${subdomain.id}.order`,
        message: 'Subdomain order must be sequential starting from 1.',
        blocking: true,
        ...context,
        subdomainId: subdomain.id,
        subdomainName: subdomain.name.en,
      });
    }
    validateSubdomain(subdomain, category, issues);
  });
}

export function validateScannerDraft(
  draft: SaveScannerDraftDto,
  _attributeTemplate: unknown
): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateLocalizedText(
    issues,
    draft.name,
    'Scanner name is required in English and Arabic.',
    'scanner',
    'error',
    'scanner.name',
    {}
  );

  if (draft.categories.length !== 5) {
    pushIssue(issues, {
      code: 'CATEGORY_COUNT_INVALID',
      level: 'scanner',
      severity: 'error',
      path: 'scanner.categories',
      message: 'Each scanner must define exactly 5 categories.',
      blocking: true,
    });
  }

  const categoryWeightTotal = sumWeights(draft.categories);
  if (!areWeightsEqual(categoryWeightTotal, 100)) {
    pushIssue(issues, {
      code: 'SCANNER_WEIGHT_INVALID',
      level: 'scanner',
      severity: 'error',
      path: 'scanner.categories.weight',
      message: `Category weights must total 100. Current total is ${categoryWeightTotal}.`,
      blocking: true,
    });
  }

  const seenQuestionIds = new Set<string>();
  const questionMap = new Map<string, { question: Question, category: Category, subdomain: Subdomain }>();
  
  draft.categories.forEach((category) => {
    validateCategory(category, issues);

    category.subdomains.forEach((subdomain) => {
      subdomain.questions.forEach((question) => {
        questionMap.set(question.id, { question, category, subdomain });
        if (seenQuestionIds.has(question.id)) {
          pushIssue(issues, {
            code: 'QUESTION_REUSED',
            level: 'question',
            severity: 'error',
            categoryId: category.id,
            categoryName: category.name.en,
            subdomainId: subdomain.id,
            subdomainName: subdomain.name.en,
            questionId: question.id,
            questionText: question.text.en,
            path: `question.${question.id}`,
            message: 'A question can belong to only one subdomain.',
            blocking: true,
          });
        }
        seenQuestionIds.add(question.id);
      });
    });
  });

  // Validate followUpTriggers
  const allFollowUpIdsWithTriggers = new Set<string>();

  draft.followUpTriggers?.forEach((trigger, idx) => {
    const triggerData = questionMap.get(trigger.triggerQuestionId);

    if (!triggerData) {
      pushIssue(issues, {
        code: 'TRIGGER_QUESTION_MISSING',
        level: 'scanner',
        severity: 'error',
        path: `scanner.followUpTriggers[${idx}]`,
        message: 'Trigger question does not exist.',
        blocking: true,
      });
      return;
    }

    const { question: triggerQuestion, category, subdomain } = triggerData;
    const context = {
      categoryId: category.id,
      categoryName: category.name.en,
      subdomainId: subdomain.id,
      subdomainName: subdomain.name.en,
      questionId: triggerQuestion.id,
      questionText: triggerQuestion.text.en,
    };

    if (triggerQuestion.kind !== 'primary') {
      pushIssue(issues, {
        code: 'TRIGGER_NOT_PRIMARY',
        level: 'question',
        severity: 'error',
        path: `scanner.followUpTriggers[${idx}]`,
        message: 'Follow-up triggers can only originate from primary questions.',
        blocking: true,
        ...context,
      });
    }

    if (trigger.triggerOptionIds.length === 0) {
      pushIssue(issues, {
        code: 'TRIGGER_OPTIONS_EMPTY',
        level: 'question',
        severity: 'error',
        path: `scanner.followUpTriggers[${idx}]`,
        message: 'Trigger must have at least one valid option selected.',
        blocking: true,
        ...context,
      });
    } else {
      const validOptionIds = new Set(triggerQuestion.options.map((o) => o.id));
      trigger.triggerOptionIds.forEach((optId) => {
        if (!validOptionIds.has(optId)) {
          pushIssue(issues, {
            code: 'TRIGGER_OPTION_INVALID',
            level: 'question',
            severity: 'error',
            path: `scanner.followUpTriggers[${idx}]`,
            message: 'One or more trigger options do not belong to the trigger question.',
            blocking: true,
            ...context,
          });
        }
      });
    }

    if (trigger.followUpQuestionIds.length === 0) {
      pushIssue(issues, {
        code: 'TRIGGER_FOLLOWUPS_EMPTY',
        level: 'question',
        severity: 'error',
        path: `scanner.followUpTriggers[${idx}]`,
        message: 'Trigger must have at least one follow-up question assigned.',
        blocking: true,
        ...context,
      });
    } else {
      trigger.followUpQuestionIds.forEach((followUpId) => {
        const followUpData = questionMap.get(followUpId);
        allFollowUpIdsWithTriggers.add(followUpId);

        if (!followUpData) {
          pushIssue(issues, {
            code: 'FOLLOW_UP_MISSING',
            level: 'question',
            severity: 'error',
            path: `scanner.followUpTriggers[${idx}]`,
            message: 'Follow-up question does not exist.',
            blocking: true,
            ...context,
          });
        } else if (followUpData.question.kind !== 'follow-up') {
          pushIssue(issues, {
            code: 'FOLLOW_UP_INVALID_KIND',
            level: 'question',
            severity: 'error',
            path: `scanner.followUpTriggers[${idx}]`,
            message: 'Trigger points to a primary question instead of a follow-up question.',
            blocking: true,
            ...context,
          });
        }
      });
    }
  });

  // Ensure all follow-up questions have a trigger
  Array.from(questionMap.values()).forEach(({ question: q, category, subdomain }) => {
    if (q.kind === 'follow-up' && !allFollowUpIdsWithTriggers.has(q.id)) {
      pushIssue(issues, {
        code: 'FOLLOW_UP_ORPHANED',
        level: 'question',
        severity: 'error',
        categoryId: category.id,
        categoryName: category.name.en,
        subdomainId: subdomain.id,
        subdomainName: subdomain.name.en,
        questionId: q.id,
        questionText: q.text.en,
        path: `question.${q.id}`,
        message: 'Follow-up question must be triggered by at least one primary question.',
        blocking: true,
      });
    }
  });

  return {
    isValid: issues.every((issue) => !issue.blocking),
    issues,
  };
}

export function validatePublishedVersion(version: ScannerVersion): ValidationResult {
  return validateScannerDraft(
    {
      name: { en: '', ar: '' },
      description: undefined,
      categories: version.categories,
      followUpTriggers: version.followUpTriggers,
    },
    null
  );
}
