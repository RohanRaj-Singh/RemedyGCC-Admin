/**
 * Scanner validation engine.
 * Shared by draft save flows and publish flows.
 */

import { AttributeTemplate } from '../../attribute-template/types';
import {
  Category,
  LocalizedText,
  Question,
  SaveScannerDraftDto,
  ScannerVersion,
  Subdomain,
  ValidationIssue,
  ValidationResult,
} from '../types';

function pushIssue(
  issues: ValidationIssue[],
  issue: ValidationIssue
) {
  issues.push(issue);
}

function isLocalizedTextComplete(value?: LocalizedText): boolean {
  return Boolean(value?.en.trim() && value?.ar.trim());
}

function sumWeights(items: Array<{ weight: number }>): number {
  return items.reduce((total, item) => total + item.weight, 0);
}

function validateLocalizedText(
  issues: ValidationIssue[],
  value: LocalizedText | undefined,
  message: string,
  level: ValidationIssue['level'],
  path: string,
  entityId?: string
) {
  if (!isLocalizedTextComplete(value)) {
    pushIssue(issues, {
      code: 'MISSING_TRANSLATION',
      level,
      entityId,
      path,
      message,
      blocking: true,
    });
  }
}

function validateQuestion(
  question: Question,
  siblingQuestions: Question[],
  issues: ValidationIssue[]
) {
  validateLocalizedText(
    issues,
    question.text,
    'Question text is required in English and Arabic.',
    'question',
    `question.${question.id}.text`,
    question.id
  );

  if (question.options.length < 2) {
    pushIssue(issues, {
      code: 'QUESTION_OPTIONS_MINIMUM',
      level: 'question',
      entityId: question.id,
      path: `question.${question.id}.options`,
      message: 'Questions must have at least two multiple-choice options.',
      blocking: true,
    });
  }

  question.options.forEach((option) => {
    validateLocalizedText(
      issues,
      option.label,
      'Every answer option is required in English and Arabic.',
      'question',
      `question.${question.id}.option.${option.id}.label`,
      question.id
    );
  });

  if (question.weight <= 0) {
    pushIssue(issues, {
      code: 'QUESTION_WEIGHT_REQUIRED',
      level: 'question',
      entityId: question.id,
      path: `question.${question.id}.weight`,
      message: 'Question weight must be greater than zero.',
      blocking: true,
    });
  }

  if (question.isFollowUp) {
    if (!question.triggerCondition?.questionId || question.triggerCondition.optionIds.length === 0) {
      pushIssue(issues, {
        code: 'FOLLOW_UP_TRIGGER_REQUIRED',
        level: 'question',
        entityId: question.id,
        path: `question.${question.id}.triggerCondition`,
        message: 'Follow-up questions require a trigger question and at least one trigger option.',
        blocking: true,
      });
    }

    const normalQuestions = siblingQuestions.filter((item) => !item.isFollowUp && item.id !== question.id);
    if (
      normalQuestions.length > 0 &&
      normalQuestions.some((item) => question.weight <= item.weight)
    ) {
      pushIssue(issues, {
        code: 'FOLLOW_UP_WEIGHT_RULE',
        level: 'question',
        entityId: question.id,
        path: `question.${question.id}.weight`,
        message: 'Follow-up questions must have a higher weight than normal questions in the same subdomain.',
        blocking: true,
      });
    }
  }
}

function validateSubdomain(subdomain: Subdomain, issues: ValidationIssue[]) {
  validateLocalizedText(
    issues,
    subdomain.name,
    'Subdomain name is required in English and Arabic.',
    'subdomain',
    `subdomain.${subdomain.id}.name`,
    subdomain.id
  );

  if (subdomain.questions.length === 0) {
    pushIssue(issues, {
      code: 'SUBDOMAIN_QUESTION_REQUIRED',
      level: 'subdomain',
      entityId: subdomain.id,
      path: `subdomain.${subdomain.id}.questions`,
      message: 'Each subdomain must contain at least one question.',
      blocking: true,
    });
  }

  const questionWeightTotal = sumWeights(subdomain.questions);
  if (questionWeightTotal !== subdomain.weight) {
    pushIssue(issues, {
      code: 'SUBDOMAIN_WEIGHT_MISMATCH',
      level: 'subdomain',
      entityId: subdomain.id,
      path: `subdomain.${subdomain.id}.weight`,
      message: `Question weights must total ${subdomain.weight} for this subdomain. Current total is ${questionWeightTotal}.`,
      blocking: true,
    });
  }

  subdomain.questions.forEach((question) =>
    validateQuestion(question, subdomain.questions, issues)
  );
}

function validateCategory(category: Category, issues: ValidationIssue[]) {
  validateLocalizedText(
    issues,
    category.name,
    'Category name is required in English and Arabic.',
    'category',
    `category.${category.id}.name`,
    category.id
  );

  if (category.subdomains.length === 0) {
    pushIssue(issues, {
      code: 'CATEGORY_SUBDOMAIN_REQUIRED',
      level: 'category',
      entityId: category.id,
      path: `category.${category.id}.subdomains`,
      message: 'Each category must contain at least one subdomain.',
      blocking: true,
    });
  }

  const subdomainWeightTotal = sumWeights(category.subdomains);
  if (subdomainWeightTotal !== category.weight) {
    pushIssue(issues, {
      code: 'CATEGORY_WEIGHT_MISMATCH',
      level: 'category',
      entityId: category.id,
      path: `category.${category.id}.weight`,
      message: `Subdomain weights must total ${category.weight} for this category. Current total is ${subdomainWeightTotal}.`,
      blocking: true,
    });
  }

  category.subdomains.forEach((subdomain) => validateSubdomain(subdomain, issues));
}

export function validateAttributeTemplate(template: AttributeTemplate | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!template) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_TEMPLATE_REQUIRED',
      level: 'attribute-template',
      path: 'attributeTemplateId',
      message: 'An attribute template is required before a scanner can be published.',
      blocking: true,
    });
    return issues;
  }

  if (template.stream.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_STREAM_REQUIRED',
      level: 'attribute-template',
      path: 'attributeTemplate.stream',
      message: 'Attribute template must contain at least one stream.',
      blocking: true,
    });
  }

  if (template.location.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_LOCATION_REQUIRED',
      level: 'attribute-template',
      path: 'attributeTemplate.location',
      message: 'Attribute template must contain at least one location.',
      blocking: true,
    });
  }

  if (template.function.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_FUNCTION_REQUIRED',
      level: 'attribute-template',
      path: 'attributeTemplate.function',
      message: 'Attribute template must contain at least one function.',
      blocking: true,
    });
  }

  if (template.department.length === 0) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_DEPARTMENT_REQUIRED',
      level: 'attribute-template',
      path: 'attributeTemplate.department',
      message: 'Attribute template must contain at least one department.',
      blocking: true,
    });
  }

  const streamIds = new Set(template.stream.map((item) => item.id));
  const locationIds = new Set(template.location.map((item) => item.id));
  const functionIds = new Set(template.function.map((item) => item.id));

  template.location.forEach((location) => {
    if (!streamIds.has(location.streamId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_LOCATION_PARENT_INVALID',
        level: 'attribute-template',
        path: `attributeTemplate.location.${location.id}.streamId`,
        message: 'Every location must belong to a valid stream.',
        blocking: true,
      });
    }
  });

  template.function.forEach((func) => {
    if (!locationIds.has(func.locationId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_FUNCTION_PARENT_INVALID',
        level: 'attribute-template',
        path: `attributeTemplate.function.${func.id}.locationId`,
        message: 'Every function must belong to a valid location.',
        blocking: true,
      });
    }
  });

  template.department.forEach((department) => {
    if (!functionIds.has(department.functionId)) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_DEPARTMENT_PARENT_INVALID',
        level: 'attribute-template',
        path: `attributeTemplate.department.${department.id}.functionId`,
        message: 'Every department must belong to a valid function.',
        blocking: true,
      });
    }
  });

  return issues;
}

export function validateScannerDraft(
  draft: SaveScannerDraftDto,
  attributeTemplate: AttributeTemplate | null
): ValidationResult {
  const issues: ValidationIssue[] = [];

  validateLocalizedText(
    issues,
    draft.name,
    'Scanner name is required in English and Arabic.',
    'scanner',
    'scanner.name'
  );

  if (!draft.attributeTemplateId) {
    pushIssue(issues, {
      code: 'ATTRIBUTE_TEMPLATE_REQUIRED',
      level: 'scanner',
      path: 'scanner.attributeTemplateId',
      message: 'Select an attribute template before publishing.',
      blocking: true,
    });
  }

  if (draft.categories.length !== 5) {
    pushIssue(issues, {
      code: 'CATEGORY_COUNT_INVALID',
      level: 'scanner',
      path: 'scanner.categories',
      message: 'Each scanner must define exactly 5 categories.',
      blocking: true,
    });
  }

  const categoryWeightTotal = sumWeights(draft.categories);
  if (categoryWeightTotal !== 100) {
    pushIssue(issues, {
      code: 'SCANNER_WEIGHT_INVALID',
      level: 'scanner',
      path: 'scanner.categories.weight',
      message: `Category weights must total 100. Current total is ${categoryWeightTotal}.`,
      blocking: true,
    });
  }

  const seenQuestionIds = new Set<string>();
  draft.categories.forEach((category) => {
    validateCategory(category, issues);

    category.subdomains.forEach((subdomain) => {
      subdomain.questions.forEach((question) => {
        if (seenQuestionIds.has(question.id)) {
          pushIssue(issues, {
            code: 'QUESTION_REUSED',
            level: 'question',
            entityId: question.id,
            path: `question.${question.id}`,
            message: 'A question can belong to only one subdomain.',
            blocking: true,
          });
        }
        seenQuestionIds.add(question.id);
      });
    });
  });

  issues.push(...validateAttributeTemplate(attributeTemplate));

  return {
    isValid: issues.every((issue) => !issue.blocking),
    issues,
  };
}

export function validatePublishedVersion(version: ScannerVersion): ValidationResult {
  return validateScannerDraft(
    {
      name: { en: '', ar: '' },
      attributeTemplateId: version.attributeTemplateId,
      description: undefined,
      categories: version.categories,
    },
    version.attributeTemplateSnapshot
  );
}
