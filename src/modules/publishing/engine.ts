import type { BrandingConfig } from '@/types/branding';
import type { TenantContentConfig } from '@/types/content';
import { validateBrandingConfig } from '@/types/branding';
import type {
  RuntimeAttributeTemplate,
  RuntimeConfigStatus,
  RuntimeScannerVersion,
  RuntimeSettings,
  RuntimeTenantSummary,
  RuntimeVersionRefs,
  TenantRuntimeConfigSnapshot,
} from '@/types/runtime-config';
import type { AttributeTemplate } from '@/modules/attribute-template/types';
import type {
  LocalizedText,
  Question,
  SaveScannerDraftDto,
  ScannerVersion,
} from '@/modules/scanner/types';
import {
  buildAttributeTemplateHierarchyMaps,
  formatHierarchyPath,
  getFunctionLineage,
  getLocationLineage,
  validateAttributeTemplateHierarchy,
} from '@/modules/attribute-template/utils';
import { validateScannerDraft } from '@/modules/scanner/utils/validation';

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  allowAnonymous: true,
  requireAuthentication: false,
  surveyExpirationDays: 30,
  allowMultipleSubmissions: false,
  language: 'en',
  featureFlags: {
    enableFollowUps: true,
  },
};

export type PublishValidationIssueLevel =
  | 'tenant'
  | 'branding'
  | 'runtime-settings'
  | 'scanner'
  | 'attribute-template'
  | 'runtime-config';

export interface PublishValidationIssue {
  code: string;
  level: PublishValidationIssueLevel;
  path: string;
  message: string;
  blocking: boolean;
}

export interface FrozenScannerVersionArtifact {
  scannerVersionId: string;
  version: string;
  fingerprint: string;
  sourceScannerId: string;
  sourceScannerVersionId: string;
  snapshot: RuntimeScannerVersion;
}

export interface FrozenAttributeTemplateArtifact {
  attributeTemplateVersionId: string;
  version: string;
  fingerprint: string;
  sourceAttributeTemplateId: string;
  snapshot: RuntimeAttributeTemplate;
}

export interface FrozenBrandingVersionArtifact {
  brandingVersionId: string;
  version: string;
  fingerprint: string;
  snapshot: BrandingConfig;
}

export interface ResolvedVersionRefAssignment {
  versionRefs: RuntimeVersionRefs;
  scannerVersion: string;
  attributeTemplateVersion: string;
  brandingVersion: string;
  reused: {
    scanner: boolean;
    attributeTemplate: boolean;
    branding: boolean;
  };
}

export interface GenerateRuntimeConfigInput {
  tenant: RuntimeTenantSummary;
  branding: BrandingConfig | null | undefined;
  content: TenantContentConfig | null | undefined;
  runtimeSettings: RuntimeSettings;
  sourceScanner: {
    scannerId: string;
    name: LocalizedText;
    description?: LocalizedText;
    version: ScannerVersion;
  } | null;
  sourceAttributeTemplate: AttributeTemplate | null;
  calculationVersionId: string;
  runtimeConfigId: string;
  publishedAt: string;
  activatedAt?: string | null;
  isActive?: boolean;
  resolveVersionRefs: (context: {
    scannerFingerprint: string;
    attributeTemplateFingerprint: string;
    brandingFingerprint: string;
    sourceScannerId: string;
    sourceScannerVersionId: string;
    sourceAttributeTemplateId: string;
    calculationVersionId: string;
  }) => ResolvedVersionRefAssignment;
}

export interface GenerateRuntimeConfigResult {
  isValid: boolean;
  issues: PublishValidationIssue[];
  warnings: string[];
  runtimeConfig: TenantRuntimeConfigSnapshot | null;
  frozenArtifacts: {
    scannerVersion: FrozenScannerVersionArtifact | null;
    attributeTemplateVersion: FrozenAttributeTemplateArtifact | null;
    brandingVersion: FrozenBrandingVersionArtifact | null;
  };
  fingerprints: {
    scanner: string | null;
    attributeTemplate: string | null;
    branding: string | null;
    runtimeConfig: string | null;
  };
  versionAssignment: ResolvedVersionRefAssignment | null;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

function fnv1a(seed: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createFingerprint(value: unknown): string {
  const seed = stableStringify(value);
  return Array.from({ length: 8 }, (_, index) => fnv1a(`${index}:${seed}`)).join('');
}

function createStableUuid(seed: string): string {
  const hex = [
    fnv1a(`${seed}:0`),
    fnv1a(`${seed}:1`).slice(0, 4),
    fnv1a(`${seed}:2`).slice(0, 4),
    fnv1a(`${seed}:3`).slice(0, 4),
    `${fnv1a(`${seed}:4`)}${fnv1a(`${seed}:5`).slice(0, 4)}`,
  ].join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function pickLocalizedValue(
  value: LocalizedText | undefined,
  language: RuntimeSettings['language'],
): string {
  if (!value) {
    return '';
  }

  const preferred = value[language]?.trim();
  if (preferred) {
    return preferred;
  }

  return value.en.trim() || value.ar.trim();
}

function normalizeLocalizedText(value: LocalizedText | undefined): LocalizedText | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = {
    en: value.en.trim(),
    ar: value.ar.trim(),
  };

  if (!normalized.en && !normalized.ar) {
    return undefined;
  }

  return normalized;
}

function pushIssue(
  issues: PublishValidationIssue[],
  issue: PublishValidationIssue,
): void {
  issues.push(issue);
}

function toScannerDraftPayload(
  sourceScanner: NonNullable<GenerateRuntimeConfigInput['sourceScanner']>,
): SaveScannerDraftDto {
  return {
    name: clone(sourceScanner.name),
    description: sourceScanner.description ? clone(sourceScanner.description) : undefined,
    categories: clone(sourceScanner.version.categories),
    followUpTriggers: clone(sourceScanner.version.followUpTriggers),
  };
}

function validateRuntimeSettings(
  runtimeSettings: RuntimeSettings,
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];

  if (runtimeSettings.allowAnonymous && runtimeSettings.requireAuthentication) {
    pushIssue(issues, {
      code: 'RUNTIME_AUTH_MODE_CONFLICT',
      level: 'runtime-settings',
      path: 'runtimeSettings',
      message: 'Runtime settings cannot allow anonymous access while also requiring authentication.',
      blocking: true,
    });
  }

  if (!runtimeSettings.allowAnonymous && !runtimeSettings.requireAuthentication) {
    pushIssue(issues, {
      code: 'RUNTIME_AUTH_MODE_MISSING',
      level: 'runtime-settings',
      path: 'runtimeSettings',
      message: 'Runtime settings must allow at least one submission access mode.',
      blocking: true,
    });
  }

  if (
    !Number.isInteger(runtimeSettings.surveyExpirationDays)
    || runtimeSettings.surveyExpirationDays <= 0
    || runtimeSettings.surveyExpirationDays > 365
  ) {
    pushIssue(issues, {
      code: 'RUNTIME_EXPIRATION_INVALID',
      level: 'runtime-settings',
      path: 'runtimeSettings.surveyExpirationDays',
      message: 'Survey expiration must be an integer between 1 and 365 days.',
      blocking: true,
    });
  }

  if (runtimeSettings.language !== 'en' && runtimeSettings.language !== 'ar') {
    pushIssue(issues, {
      code: 'RUNTIME_LANGUAGE_INVALID',
      level: 'runtime-settings',
      path: 'runtimeSettings.language',
      message: 'Runtime language must be either "en" or "ar".',
      blocking: true,
    });
  }

  const invalidFeatureFlag = Object.entries(runtimeSettings.featureFlags ?? {}).find(
    ([, enabled]) => typeof enabled !== 'boolean',
  );

  if (invalidFeatureFlag) {
    pushIssue(issues, {
      code: 'RUNTIME_FEATURE_FLAG_INVALID',
      level: 'runtime-settings',
      path: `runtimeSettings.featureFlags.${invalidFeatureFlag[0]}`,
      message: 'Runtime feature flags must use boolean values only.',
      blocking: true,
    });
  }

  return issues;
}

function buildRuntimeAttributeTemplate(
  sourceAttributeTemplate: AttributeTemplate,
): RuntimeAttributeTemplate {
  const streamIdMap = new Map(
    sourceAttributeTemplate.stream.map((stream) => [
      stream.id,
      createStableUuid(`stream:${stream.id}`),
    ]),
  );

  const locationIdMap = new Map(
    sourceAttributeTemplate.location.map((location) => [
      location.id,
      createStableUuid(`location:${location.id}`),
    ]),
  );

  const functionIdMap = new Map(
    sourceAttributeTemplate.function.map((func) => [
      func.id,
      createStableUuid(`function:${func.id}`),
    ]),
  );

  return {
    streams: sourceAttributeTemplate.stream.map((stream) => ({
      id: streamIdMap.get(stream.id)!,
      label: stream.label,
      value: stream.id,
    })),
    locations: sourceAttributeTemplate.location.map((location) => ({
      id: locationIdMap.get(location.id)!,
      label: location.label,
      value: location.id,
      streamId: streamIdMap.get(location.streamId)!,
    })),
    functions: sourceAttributeTemplate.function.map((func) => ({
      id: functionIdMap.get(func.id)!,
      label: func.label,
      value: func.id,
      locationId: locationIdMap.get(func.locationId)!,
    })),
    departments: sourceAttributeTemplate.department.map((department) => ({
      id: createStableUuid(`department:${department.id}`),
      label: department.label,
      value: department.id,
      functionId: functionIdMap.get(department.functionId)!,
    })),
    genders: sourceAttributeTemplate.gender.map((option) => option.id),
    ageGroups: sourceAttributeTemplate.age.map((option) => option.id),
    seniorityLevels: sourceAttributeTemplate.seniority.map((option) => option.id),
    fixedAttributes: {
      location: {
        enabled: sourceAttributeTemplate.location.length > 0,
        required: sourceAttributeTemplate.location.length > 0,
        label: 'Location',
        placeholder: 'Select a location',
      },
      gender: {
        enabled: sourceAttributeTemplate.gender.length > 0,
        required: sourceAttributeTemplate.gender.length > 0,
        label: 'Gender',
        placeholder: 'Select a gender',
      },
      age: {
        enabled: sourceAttributeTemplate.age.length > 0,
        required: sourceAttributeTemplate.age.length > 0,
        label: 'Age',
        placeholder: 'Select an age group',
      },
      seniority: {
        enabled: sourceAttributeTemplate.seniority.length > 0,
        required: sourceAttributeTemplate.seniority.length > 0,
        label: 'Seniority',
        placeholder: 'Select a seniority level',
      },
    },
  };
}

function validateRuntimeAttributeTemplate(
  sourceAttributeTemplate: AttributeTemplate,
  runtimeAttributeTemplate: RuntimeAttributeTemplate,
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const sourceIssues = validateAttributeTemplateHierarchy(sourceAttributeTemplate);
  const hierarchyMaps = buildAttributeTemplateHierarchyMaps(sourceAttributeTemplate);

  sourceIssues.forEach((issue) => {
    pushIssue(issues, {
      code: issue.code,
      level: 'attribute-template',
      path: issue.path,
      message: issue.message,
      blocking: issue.blocking,
    });
  });

  sourceAttributeTemplate.stream.forEach((stream) => {
    const streamLocations = sourceAttributeTemplate.location.filter(
      (location) => location.streamId === stream.id,
    );

    if (streamLocations.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_STREAM_LOCATION_MISSING',
        level: 'attribute-template',
        path: `attributeTemplate.stream.${stream.id}`,
        message: `Stream "${stream.label}" must expose at least one location for runtime filtering.`,
        blocking: true,
      });
    }

    const streamHasCompleteBranch = streamLocations.some((location) => {
      const functions = hierarchyMaps.functionsByLocationId.get(location.id) ?? [];
      return functions.some((func) => (hierarchyMaps.departmentsByFunctionId.get(func.id) ?? []).length > 0);
    });

    if (!streamHasCompleteBranch) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_STREAM_CHAIN_INCOMPLETE',
        level: 'attribute-template',
        path: `attributeTemplate.stream.${stream.id}`,
        message: `Stream "${stream.label}" must expose at least one complete location -> function -> department path for runtime use.`,
        blocking: true,
      });
    }
  });

  sourceAttributeTemplate.location.forEach((location) => {
    const locationFunctions = hierarchyMaps.functionsByLocationId.get(location.id) ?? [];

    if (locationFunctions.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_LOCATION_FUNCTION_MISSING',
        level: 'attribute-template',
        path: `attributeTemplate.location.${location.id}`,
        message: `Location "${location.label}" inside ${formatHierarchyPath(getLocationLineage(location, hierarchyMaps))} must expose at least one function for runtime filtering.`,
        blocking: true,
      });
    }
  });

  sourceAttributeTemplate.function.forEach((func) => {
    const functionDepartments = hierarchyMaps.departmentsByFunctionId.get(func.id) ?? [];

    if (functionDepartments.length === 0) {
      pushIssue(issues, {
        code: 'ATTRIBUTE_FUNCTION_DEPARTMENT_MISSING',
        level: 'attribute-template',
        path: `attributeTemplate.function.${func.id}`,
        message: `Function "${func.label}" inside ${formatHierarchyPath(getFunctionLineage(func, hierarchyMaps))} must expose at least one department for runtime filtering.`,
        blocking: true,
      });
    }
  });

  if (runtimeAttributeTemplate.streams.length === 0) {
    pushIssue(issues, {
      code: 'RUNTIME_STREAMS_EMPTY',
      level: 'runtime-config',
      path: 'attributeTemplate.streams',
      message: 'Runtime attribute template must include at least one stream.',
      blocking: true,
    });
  }

  if (
    runtimeAttributeTemplate.locations.length === 0
    || runtimeAttributeTemplate.functions.length === 0
    || runtimeAttributeTemplate.departments.length === 0
  ) {
    pushIssue(issues, {
      code: 'RUNTIME_ATTRIBUTE_HIERARCHY_EMPTY',
      level: 'runtime-config',
      path: 'attributeTemplate',
      message: 'Runtime attribute template must include at least one valid stream to location to function to department path.',
      blocking: true,
    });
  }

  return issues;
}

function buildRuntimeScannerVersion(
  sourceScanner: NonNullable<GenerateRuntimeConfigInput['sourceScanner']>,
  runtimeSettings: RuntimeSettings,
  publishedAt: string,
  scannerVersionId: string,
  version: string,
  isActive: boolean,
): RuntimeScannerVersion {
  const questionIdMap = new Map<string, string>();

  const mapQuestionId = (questionId: string) => {
    const existing = questionIdMap.get(questionId);
    if (existing) {
      return existing;
    }

    const next = createStableUuid(`question:${questionId}`);
    questionIdMap.set(questionId, next);
    return next;
  };

  return {
    id: scannerVersionId,
    version,
    publishedAt,
    isActive,
    categories: sourceScanner.version.categories.map((category) => ({
      id: createStableUuid(`category:${category.id}`),
      order: category.order,
      label: pickLocalizedValue(category.name, runtimeSettings.language),
      labelTranslations: normalizeLocalizedText(category.name),
      description: pickLocalizedValue(category.name, runtimeSettings.language),
      descriptionTranslations: normalizeLocalizedText(category.name),
      weight: category.weight,
      subdomains: category.subdomains.map((subdomain) => ({
        id: createStableUuid(`subdomain:${subdomain.id}`),
        order: subdomain.order,
        label: pickLocalizedValue(subdomain.name, runtimeSettings.language),
        labelTranslations: normalizeLocalizedText(subdomain.name),
        description: pickLocalizedValue(subdomain.name, runtimeSettings.language),
        descriptionTranslations: normalizeLocalizedText(subdomain.name),
        weight: subdomain.weight,
        questions: subdomain.questions.map((question) => ({
          id: mapQuestionId(question.id),
          order: question.order,
          questionText: pickLocalizedValue(question.text, runtimeSettings.language),
          questionTextTranslations: normalizeLocalizedText(question.text),
          weight: question.weight ?? 0,
          kind: question.kind,
          answers: question.options.map((option) => ({
            id: createStableUuid(`answer:${question.id}:${option.id}`),
            order: option.order,
            label: pickLocalizedValue(option.label, runtimeSettings.language),
            labelTranslations: normalizeLocalizedText(option.label),
            score: option.score,
          })),
        })),
      })),
    })),
    followUpTriggers: sourceScanner.version.followUpTriggers.map((trigger) => {
      const triggerQuestion = sourceScanner.version.categories
        .flatMap((category) => category.subdomains)
        .flatMap((subdomain) => subdomain.questions)
        .find((question) => question.id === trigger.triggerQuestionId);

      const triggerScores = triggerQuestion
        ? trigger.triggerOptionIds
          .map((optionId) => triggerQuestion.options.find((option) => option.id === optionId))
          .filter((option): option is Question['options'][number] => Boolean(option))
          .map((option) => option.score)
        : [];

      return {
        id: createStableUuid(`trigger:${trigger.id}`),
        triggerQuestionId: mapQuestionId(trigger.triggerQuestionId),
        triggerAnswerScores: Array.from(new Set(triggerScores)),
        followUpQuestionIds: trigger.followUpQuestionIds.map((questionId) => mapQuestionId(questionId)),
      };
    }),
  };
}

function validateGeneratedScanner(
  sourceScanner: NonNullable<GenerateRuntimeConfigInput['sourceScanner']>,
  sourceAttributeTemplate: AttributeTemplate | null,
  runtimeScannerVersion: RuntimeScannerVersion,
): PublishValidationIssue[] {
  const issues: PublishValidationIssue[] = [];
  const sourceValidation = validateScannerDraft(
    toScannerDraftPayload(sourceScanner),
    sourceAttributeTemplate,
  );

  sourceValidation.issues.forEach((issue) => {
    pushIssue(issues, {
      code: issue.code,
      level: issue.level === 'attribute-template' ? 'attribute-template' : 'scanner',
      path: issue.path,
      message: issue.message,
      blocking: issue.blocking,
    });
  });

  if (runtimeScannerVersion.categories.length === 0) {
    pushIssue(issues, {
      code: 'RUNTIME_SCANNER_EMPTY',
      level: 'runtime-config',
      path: 'scannerVersion.categories',
      message: 'Runtime scanner must include at least one category.',
      blocking: true,
    });
  }

  const seenQuestionIds = new Set<string>();
  const answerLookup = new Map<string, Set<number>>();
  const questionKinds = new Map<string, RuntimeScannerVersion['categories'][number]['subdomains'][number]['questions'][number]['kind']>();

  runtimeScannerVersion.categories.forEach((category) => {
    if (!category.label.trim()) {
      pushIssue(issues, {
        code: 'RUNTIME_CATEGORY_LABEL_MISSING',
        level: 'runtime-config',
        path: `scannerVersion.categories.${category.id}.label`,
        message: 'Runtime categories must include display labels.',
        blocking: true,
      });
    }

    category.subdomains.forEach((subdomain) => {
      if (!subdomain.label.trim()) {
        pushIssue(issues, {
          code: 'RUNTIME_SUBDOMAIN_LABEL_MISSING',
          level: 'runtime-config',
          path: `scannerVersion.subdomains.${subdomain.id}.label`,
          message: 'Runtime subdomains must include display labels.',
          blocking: true,
        });
      }

      subdomain.questions.forEach((question) => {
        questionKinds.set(question.id, question.kind);

        if (seenQuestionIds.has(question.id)) {
          pushIssue(issues, {
            code: 'RUNTIME_QUESTION_DUPLICATE',
            level: 'runtime-config',
            path: `scannerVersion.questions.${question.id}`,
            message: 'Runtime scanner contains duplicate question identifiers.',
            blocking: true,
          });
        }
        seenQuestionIds.add(question.id);

        if (!question.questionText.trim()) {
          pushIssue(issues, {
            code: 'RUNTIME_QUESTION_TEXT_MISSING',
            level: 'runtime-config',
            path: `scannerVersion.questions.${question.id}.questionText`,
            message: 'Runtime questions must include question text.',
            blocking: true,
          });
        }

        if (!Number.isFinite(question.weight) || question.weight <= 0) {
          pushIssue(issues, {
            code: 'RUNTIME_QUESTION_WEIGHT_INVALID',
            level: 'runtime-config',
            path: `scannerVersion.questions.${question.id}.weight`,
            message: 'Runtime questions must include a positive weight.',
            blocking: true,
          });
        }

        if (question.answers.length < 2) {
          pushIssue(issues, {
            code: 'RUNTIME_QUESTION_ANSWERS_INVALID',
            level: 'runtime-config',
            path: `scannerVersion.questions.${question.id}.answers`,
            message: 'Runtime questions must include at least two answers.',
            blocking: true,
          });
        }

        answerLookup.set(
          question.id,
          new Set(question.answers.map((answer) => answer.score)),
        );

        question.answers.forEach((answer) => {
          if (!answer.label.trim()) {
            pushIssue(issues, {
              code: 'RUNTIME_ANSWER_LABEL_MISSING',
              level: 'runtime-config',
              path: `scannerVersion.questions.${question.id}.answers.${answer.id}.label`,
              message: 'Runtime answers must include labels.',
              blocking: true,
            });
          }

          if (!Number.isFinite(answer.score)) {
            pushIssue(issues, {
              code: 'RUNTIME_ANSWER_SCORE_INVALID',
              level: 'runtime-config',
              path: `scannerVersion.questions.${question.id}.answers.${answer.id}.score`,
              message: 'Runtime answers must include explicit numeric scores.',
              blocking: true,
            });
          }
        });
      });
    });
  });

  runtimeScannerVersion.followUpTriggers.forEach((trigger) => {
    if (!questionKinds.has(trigger.triggerQuestionId)) {
      pushIssue(issues, {
        code: 'RUNTIME_TRIGGER_QUESTION_MISSING',
        level: 'runtime-config',
        path: `scannerVersion.followUpTriggers.${trigger.id}`,
        message: 'Follow-up triggers must point to questions that exist in the same runtime scanner snapshot.',
        blocking: true,
      });
    } else if (questionKinds.get(trigger.triggerQuestionId) !== 'primary') {
      pushIssue(issues, {
        code: 'RUNTIME_TRIGGER_SOURCE_INVALID',
        level: 'runtime-config',
        path: `scannerVersion.followUpTriggers.${trigger.id}`,
        message: 'Follow-up triggers must originate from primary questions only.',
        blocking: true,
      });
    }

    if (trigger.triggerAnswerScores.length === 0) {
      pushIssue(issues, {
        code: 'RUNTIME_TRIGGER_SCORES_EMPTY',
        level: 'runtime-config',
        path: `scannerVersion.followUpTriggers.${trigger.id}.triggerAnswerScores`,
        message: 'Follow-up triggers must preserve at least one answer score reference.',
        blocking: true,
      });
    }

    const validScores = answerLookup.get(trigger.triggerQuestionId);
    trigger.triggerAnswerScores.forEach((score) => {
      if (!validScores?.has(score)) {
        pushIssue(issues, {
          code: 'RUNTIME_TRIGGER_SCORE_INVALID',
          level: 'runtime-config',
          path: `scannerVersion.followUpTriggers.${trigger.id}.triggerAnswerScores`,
          message: 'Follow-up triggers must reference answer scores that exist on the trigger question.',
          blocking: true,
        });
      }
    });

    trigger.followUpQuestionIds.forEach((followUpQuestionId) => {
      const followUpKind = questionKinds.get(followUpQuestionId);
      if (!followUpKind) {
        pushIssue(issues, {
          code: 'RUNTIME_TRIGGER_TARGET_MISSING',
          level: 'runtime-config',
          path: `scannerVersion.followUpTriggers.${trigger.id}.followUpQuestionIds`,
          message: 'Follow-up triggers must only reference questions that exist in the same runtime scanner snapshot.',
          blocking: true,
        });
      } else if (followUpKind !== 'follow-up') {
        pushIssue(issues, {
          code: 'RUNTIME_TRIGGER_TARGET_KIND_INVALID',
          level: 'runtime-config',
          path: `scannerVersion.followUpTriggers.${trigger.id}.followUpQuestionIds`,
          message: 'Follow-up triggers must only point to follow-up questions.',
          blocking: true,
        });
      }
    });
  });

  return issues;
}

export function generateRuntimeConfig(
  input: GenerateRuntimeConfigInput,
): GenerateRuntimeConfigResult {
  const issues: PublishValidationIssue[] = [];
  const warnings: string[] = [];

  if (!input.tenant.slug.trim()) {
    pushIssue(issues, {
      code: 'TENANT_SLUG_MISSING',
      level: 'tenant',
      path: 'tenant.slug',
      message: 'Tenant slug is required before a runtime snapshot can be published.',
      blocking: true,
    });
  }

  if (!input.tenant.name.trim()) {
    pushIssue(issues, {
      code: 'TENANT_NAME_MISSING',
      level: 'tenant',
      path: 'tenant.name',
      message: 'Tenant name is required before a runtime snapshot can be published.',
      blocking: true,
    });
  }

  if (input.tenant.status === 'archived') {
    pushIssue(issues, {
      code: 'TENANT_ARCHIVED',
      level: 'tenant',
      path: 'tenant.status',
      message: 'Archived tenants cannot publish new runtime snapshots.',
      blocking: true,
    });
  }

  if (!input.sourceScanner) {
    pushIssue(issues, {
      code: 'SCANNER_SOURCE_REQUIRED',
      level: 'scanner',
      path: 'sourceScanner',
      message: 'A canonical scanner source must be available before publishing a runtime snapshot.',
      blocking: true,
    });
  }

  const brandingValidation = validateBrandingConfig(input.branding);
  brandingValidation.errors.forEach((message, index) => {
    pushIssue(issues, {
      code: `BRANDING_ERROR_${index + 1}`,
      level: 'branding',
      path: 'branding',
      message,
      blocking: true,
    });
  });
  warnings.push(...brandingValidation.warnings);

  validateRuntimeSettings(input.runtimeSettings).forEach((issue) => pushIssue(issues, issue));

  const blockingIssues = issues.filter((issue) => issue.blocking);
  if (blockingIssues.length > 0 || !input.sourceScanner || !input.sourceAttributeTemplate) {
    return {
      isValid: false,
      issues,
      warnings,
      runtimeConfig: null,
      frozenArtifacts: {
        scannerVersion: null,
        attributeTemplateVersion: null,
        brandingVersion: null,
      },
      fingerprints: {
        scanner: null,
        attributeTemplate: null,
        branding: null,
        runtimeConfig: null,
      },
      versionAssignment: null,
    };
  }

  const runtimeAttributeTemplate = buildRuntimeAttributeTemplate(input.sourceAttributeTemplate);
  validateRuntimeAttributeTemplate(
    input.sourceAttributeTemplate,
    runtimeAttributeTemplate,
  ).forEach((issue) => pushIssue(issues, issue));

  const brandingSnapshot = clone(input.branding ?? {});
  const brandingFingerprint = createFingerprint(brandingSnapshot);
  const attributeTemplateFingerprint = createFingerprint(runtimeAttributeTemplate);
  const scannerPreviewFingerprint = createFingerprint({
    sourceScannerId: input.sourceScanner.scannerId,
    sourceScannerVersionId: input.sourceScanner.version.id,
    language: input.runtimeSettings.language,
    categories: input.sourceScanner.version.categories,
    followUpTriggers: input.sourceScanner.version.followUpTriggers,
  });

  const versionAssignment = input.resolveVersionRefs({
    scannerFingerprint: scannerPreviewFingerprint,
    attributeTemplateFingerprint,
    brandingFingerprint,
    sourceScannerId: input.sourceScanner.scannerId,
    sourceScannerVersionId: input.sourceScanner.version.id,
    sourceAttributeTemplateId: input.sourceAttributeTemplate.id,
    calculationVersionId: input.calculationVersionId,
  });

  const runtimeScannerVersion = buildRuntimeScannerVersion(
    input.sourceScanner,
    input.runtimeSettings,
    input.publishedAt,
    versionAssignment.versionRefs.scannerVersionId,
    versionAssignment.scannerVersion,
    Boolean(input.isActive),
  );

  validateGeneratedScanner(
    input.sourceScanner,
    input.sourceAttributeTemplate,
    runtimeScannerVersion,
  ).forEach((issue) => pushIssue(issues, issue));

  const scannerFingerprint = createFingerprint(runtimeScannerVersion);
  const runtimeConfig: TenantRuntimeConfigSnapshot = {
    runtimeConfigId: input.runtimeConfigId,
    publishedAt: input.publishedAt,
    activatedAt: input.activatedAt ?? null,
    tenant: clone(input.tenant),
    versionRefs: clone(versionAssignment.versionRefs),
    branding: brandingSnapshot,
    content: clone(input.content ?? {}),
    attributeTemplate: clone(runtimeAttributeTemplate),
    scannerVersion: clone(runtimeScannerVersion),
    runtimeSettings: clone(input.runtimeSettings),
  };
  const runtimeConfigFingerprint = createFingerprint({
    tenant: runtimeConfig.tenant,
    versionRefs: runtimeConfig.versionRefs,
    branding: runtimeConfig.branding,
    content: runtimeConfig.content,
    attributeTemplate: runtimeConfig.attributeTemplate,
    scannerVersion: runtimeConfig.scannerVersion,
    runtimeSettings: runtimeConfig.runtimeSettings,
  });

  const hasBlockingIssue = issues.some((issue) => issue.blocking);
  if (hasBlockingIssue) {
    return {
      isValid: false,
      issues,
      warnings,
      runtimeConfig: null,
      frozenArtifacts: {
        scannerVersion: null,
        attributeTemplateVersion: null,
        brandingVersion: null,
      },
      fingerprints: {
        scanner: scannerFingerprint,
        attributeTemplate: attributeTemplateFingerprint,
        branding: brandingFingerprint,
        runtimeConfig: runtimeConfigFingerprint,
      },
      versionAssignment,
    };
  }

  return {
    isValid: true,
    issues,
    warnings,
    runtimeConfig,
    frozenArtifacts: {
      scannerVersion: {
        scannerVersionId: versionAssignment.versionRefs.scannerVersionId,
        version: versionAssignment.scannerVersion,
        fingerprint: scannerFingerprint,
        sourceScannerId: input.sourceScanner.scannerId,
        sourceScannerVersionId: input.sourceScanner.version.id,
        snapshot: clone(runtimeScannerVersion),
      },
      attributeTemplateVersion: {
        attributeTemplateVersionId: versionAssignment.versionRefs.attributeTemplateVersionId,
        version: versionAssignment.attributeTemplateVersion,
        fingerprint: attributeTemplateFingerprint,
        sourceAttributeTemplateId: input.sourceAttributeTemplate.id,
        snapshot: clone(runtimeAttributeTemplate),
      },
      brandingVersion: {
        brandingVersionId: versionAssignment.versionRefs.brandingVersionId,
        version: versionAssignment.brandingVersion,
        fingerprint: brandingFingerprint,
        snapshot: brandingSnapshot,
      },
    },
    fingerprints: {
      scanner: scannerFingerprint,
      attributeTemplate: attributeTemplateFingerprint,
      branding: brandingFingerprint,
      runtimeConfig: runtimeConfigFingerprint,
    },
    versionAssignment,
  };
}

export function getRuntimeConfigFingerprint(
  runtimeConfig: TenantRuntimeConfigSnapshot,
): string {
  return createFingerprint({
    tenant: runtimeConfig.tenant,
    versionRefs: runtimeConfig.versionRefs,
    branding: runtimeConfig.branding,
    content: runtimeConfig.content,
    attributeTemplate: runtimeConfig.attributeTemplate,
    scannerVersion: runtimeConfig.scannerVersion,
    runtimeSettings: runtimeConfig.runtimeSettings,
  });
}

export function getRuntimeConfigStatusLabel(status: RuntimeConfigStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Published';
    case 'active':
      return 'Active';
    case 'disabled':
      return 'Disabled';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}
