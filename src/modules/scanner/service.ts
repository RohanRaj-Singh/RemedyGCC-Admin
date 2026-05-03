/**
 * Scanner Service
 * Mock persistence for strict scanner admin workflows.
 */

import { getAllTemplates, getTemplateById as getAttributeTemplateById } from '../attribute-template/service';
import { AttributeTemplate } from '../attribute-template/types';
import { Category, CreateScannerDto, LocalizedText, SaveScannerDraftDto, Scanner, ScannerDetail, ScannerStatus, ScannerVersion, ScannerVersionSummary, TemplateOption, ValidationResult } from './types';
import { validateScannerDraft } from './utils/validation';
import { createDefaultCategories, createId } from './utils/builder';

interface StoredScanner {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  status: ScannerStatus;
  createdAt: string;
  updatedAt: string;
  versions: ScannerVersion[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveVersionForSummary(scanner: StoredScanner): ScannerVersion | null {
  return scanner.versions.find((version) => version.status === 'draft')
    ?? scanner.versions.find((version) => version.status === 'published')
    ?? null;
}

function toVersionSummary(version: ScannerVersion): ScannerVersionSummary {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    status: version.status,
    sourceVersionId: version.sourceVersionId,
    responseCount: version.responseCount,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    isImmutable: version.status === 'published',
  };
}

function toScannerSummary(scanner: StoredScanner): Scanner {
  const activeVersion = resolveVersionForSummary(scanner);
  const publishedVersion = scanner.versions
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;

  const draftVersion = scanner.versions
    .filter((version) => version.status === 'draft')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;

  const categories = activeVersion?.categories ?? [];
  const subdomainCount = categories.reduce((total, category) => total + category.subdomains.length, 0);
  const questionCount = categories.reduce(
    (total, category) =>
      total + category.subdomains.reduce((subTotal, subdomain) => subTotal + subdomain.questions.length, 0),
    0
  );

  return {
    id: scanner.id,
    name: clone(scanner.name),
    description: scanner.description ? clone(scanner.description) : undefined,
    status: scanner.status,
    latestVersionNumber: scanner.versions.reduce(
      (current, version) => Math.max(current, version.versionNumber),
      0
    ),
    draftVersionId: draftVersion?.id ?? null,
    publishedVersionId: publishedVersion?.id ?? null,
    attributeTemplateId: activeVersion?.attributeTemplateId ?? publishedVersion?.attributeTemplateId ?? null,
    attributeTemplateName: activeVersion?.attributeTemplateName ?? publishedVersion?.attributeTemplateName,
    categoryCount: categories.length,
    subdomainCount,
    questionCount,
    hasResponses: scanner.versions.some((version) => version.responseCount > 0),
    hasUnpublishedChanges:
      Boolean(draftVersion) &&
      (!publishedVersion || draftVersion.versionNumber !== publishedVersion.versionNumber),
    createdAt: scanner.createdAt,
    updatedAt: scanner.updatedAt,
  };
}

function toScannerDetail(scanner: StoredScanner): ScannerDetail {
  const summary = toScannerSummary(scanner);
  const draftVersion = scanner.versions
    .filter((version) => version.status === 'draft')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
  const publishedVersion = scanner.versions
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;

  return {
    ...summary,
    draftVersion: draftVersion ? clone(draftVersion) : null,
    publishedVersion: publishedVersion ? clone(publishedVersion) : null,
    versions: scanner.versions
      .slice()
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .map(toVersionSummary),
  };
}

function createVersion(
  scannerId: string,
  versionNumber: number,
  attributeTemplateId: string,
  attributeTemplateName: string | undefined,
  attributeTemplateSnapshot: AttributeTemplate | null,
  categories: Category[],
  status: ScannerVersion['status'],
  sourceVersionId: string | null,
  responseCount = 0,
  publishedAt?: string
): ScannerVersion {
  const now = new Date().toISOString();
  return {
    id: createId('scanner-version'),
    scannerId,
    versionNumber,
    status,
    sourceVersionId,
    attributeTemplateId,
    attributeTemplateName,
    attributeTemplateSnapshot: attributeTemplateSnapshot ? clone(attributeTemplateSnapshot) : null,
    categories: clone(categories),
    responseCount,
    publishedAt,
    createdAt: now,
    updatedAt: now,
  };
}

const seededScanners: StoredScanner[] = [
  (() => {
    const scannerId = 'scanner-1';
    const publishedCategories: Category[] = [
      {
        id: 'category-1',
        slot: 1,
        name: { en: 'Mental Health', ar: 'الصحة النفسية' },
        polarity: 'negative',
        weight: 30,
        subdomains: [
          {
            id: 'subdomain-1',
            categoryId: 'category-1',
            name: { en: 'Burnout', ar: 'الاحتراق الوظيفي' },
            weight: 30,
            questions: [
              {
                id: 'question-1',
                subdomainId: 'subdomain-1',
                text: {
                  en: 'How often do you feel emotionally exhausted at work?',
                  ar: 'كم مرة تشعر بالإرهاق العاطفي في العمل؟',
                },
                weight: 18,
                isFollowUp: false,
                options: [
                  { id: 'option-1', label: { en: 'Never', ar: 'أبداً' }, scoreValue: 0 },
                  { id: 'option-2', label: { en: 'Sometimes', ar: 'أحياناً' }, scoreValue: 50 },
                  { id: 'option-3', label: { en: 'Often', ar: 'غالباً' }, scoreValue: 100 },
                ],
              },
              {
                id: 'question-2',
                subdomainId: 'subdomain-1',
                text: {
                  en: 'If often, has this affected your attendance?',
                  ar: 'إذا كان ذلك غالباً، فهل أثر على حضورك؟',
                },
                weight: 12,
                isFollowUp: true,
                triggerCondition: { questionId: 'question-1', optionIds: ['option-3'] },
                options: [
                  { id: 'option-4', label: { en: 'No', ar: 'لا' }, scoreValue: 25 },
                  { id: 'option-5', label: { en: 'Yes', ar: 'نعم' }, scoreValue: 100 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'category-2',
        slot: 2,
        name: { en: 'Leadership', ar: 'القيادة' },
        polarity: 'positive',
        weight: 20,
        subdomains: [
          {
            id: 'subdomain-2',
            categoryId: 'category-2',
            name: { en: 'Trust', ar: 'الثقة' },
            weight: 20,
            questions: [
              {
                id: 'question-3',
                subdomainId: 'subdomain-2',
                text: {
                  en: 'My manager communicates clearly.',
                  ar: 'مديري يتواصل بوضوح.',
                },
                weight: 20,
                isFollowUp: false,
                options: [
                  { id: 'option-6', label: { en: 'Disagree', ar: 'لا أوافق' }, scoreValue: 0 },
                  { id: 'option-7', label: { en: 'Neutral', ar: 'محايد' }, scoreValue: 50 },
                  { id: 'option-8', label: { en: 'Agree', ar: 'أوافق' }, scoreValue: 100 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'category-3',
        slot: 3,
        name: { en: 'Morale', ar: 'الروح المعنوية' },
        polarity: 'positive',
        weight: 15,
        subdomains: [
          {
            id: 'subdomain-3',
            categoryId: 'category-3',
            name: { en: 'Belonging', ar: 'الانتماء' },
            weight: 15,
            questions: [
              {
                id: 'question-4',
                subdomainId: 'subdomain-3',
                text: {
                  en: 'I feel valued by my team.',
                  ar: 'أشعر بأن فريقي يقدرني.',
                },
                weight: 15,
                isFollowUp: false,
                options: [
                  { id: 'option-9', label: { en: 'Disagree', ar: 'لا أوافق' }, scoreValue: 0 },
                  { id: 'option-10', label: { en: 'Neutral', ar: 'محايد' }, scoreValue: 50 },
                  { id: 'option-11', label: { en: 'Agree', ar: 'أوافق' }, scoreValue: 100 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'category-4',
        slot: 4,
        name: { en: 'Clinical Risk', ar: 'المخاطر السريرية' },
        polarity: 'negative',
        weight: 20,
        subdomains: [
          {
            id: 'subdomain-4',
            categoryId: 'category-4',
            name: { en: 'Escalation', ar: 'التصعيد' },
            weight: 20,
            questions: [
              {
                id: 'question-5',
                subdomainId: 'subdomain-4',
                text: {
                  en: 'I have recently considered leaving due to stress.',
                  ar: 'فكرت مؤخراً في المغادرة بسبب الضغط.',
                },
                weight: 20,
                isFollowUp: false,
                options: [
                  { id: 'option-12', label: { en: 'No', ar: 'لا' }, scoreValue: 0 },
                  { id: 'option-13', label: { en: 'Maybe', ar: 'ربما' }, scoreValue: 60 },
                  { id: 'option-14', label: { en: 'Yes', ar: 'نعم' }, scoreValue: 100 },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'category-5',
        slot: 5,
        name: { en: 'Workload', ar: 'عبء العمل' },
        polarity: 'negative',
        weight: 15,
        subdomains: [
          {
            id: 'subdomain-5',
            categoryId: 'category-5',
            name: { en: 'Pressure', ar: 'الضغط' },
            weight: 15,
            questions: [
              {
                id: 'question-6',
                subdomainId: 'subdomain-5',
                text: {
                  en: 'My workload is manageable.',
                  ar: 'عبء عملي يمكن التحكم به.',
                },
                weight: 15,
                isFollowUp: false,
                options: [
                  { id: 'option-15', label: { en: 'Never', ar: 'أبداً' }, scoreValue: 100 },
                  { id: 'option-16', label: { en: 'Sometimes', ar: 'أحياناً' }, scoreValue: 50 },
                  { id: 'option-17', label: { en: 'Always', ar: 'دائماً' }, scoreValue: 0 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const publishedVersion = createVersion(
      scannerId,
      1,
      'attr-1',
      'Default Corporate Template',
      null,
      publishedCategories,
      'published',
      null,
      128,
      '2026-04-01T10:00:00.000Z'
    );

    const draftCategories = clone(publishedCategories);
    draftCategories[1].subdomains[0].questions[0].text.en = 'My manager communicates clearly and consistently.';
    draftCategories[1].subdomains[0].questions[0].text.ar = 'مديري يتواصل بوضوح واستمرار.';

    const draftVersion = createVersion(
      scannerId,
      2,
      'attr-1',
      'Default Corporate Template',
      null,
      draftCategories,
      'draft',
      publishedVersion.id
    );

    return {
      id: scannerId,
      name: { en: 'Workplace Health Scanner', ar: 'ماسح صحة مكان العمل' },
      description: {
        en: 'Core methodology for workforce health and climate assessments.',
        ar: 'منهجية أساسية لتقييم صحة القوى العاملة والمناخ الوظيفي.',
      },
      status: 'published',
      createdAt: '2026-03-10T09:00:00.000Z',
      updatedAt: draftVersion.updatedAt,
      versions: [publishedVersion, draftVersion],
    };
  })(),
  (() => {
    const scannerId = 'scanner-2';
    const draftVersion = createVersion(
      scannerId,
      1,
      'attr-2',
      'Startup Template',
      null,
      createDefaultCategories(),
      'draft',
      null
    );

    return {
      id: scannerId,
      name: { en: 'New Scanner Draft', ar: 'مسودة ماسح جديد' },
      description: {
        en: 'Draft scanner waiting for taxonomy setup.',
        ar: 'مسودة ماسح بانتظار إعداد التصنيف.',
      },
      status: 'draft',
      createdAt: '2026-04-22T09:30:00.000Z',
      updatedAt: draftVersion.updatedAt,
      versions: [draftVersion],
    };
  })(),
];

let scanners: StoredScanner[] = seededScanners;

function findScanner(scannerId: string): StoredScanner {
  const scanner = scanners.find((item) => item.id === scannerId);
  if (!scanner) {
    throw new Error('Scanner not found');
  }
  return scanner;
}

async function resolveTemplateSnapshot(attributeTemplateId: string) {
  return await getAttributeTemplateById(attributeTemplateId);
}

export async function getScanners(): Promise<Scanner[]> {
  await delay(200);
  return scanners.map(toScannerSummary);
}

export async function getScannerById(id: string): Promise<ScannerDetail | null> {
  await delay(200);
  const scanner = scanners.find((item) => item.id === id);
  return scanner ? toScannerDetail(scanner) : null;
}

export async function getTemplates(): Promise<TemplateOption[]> {
  await delay(150);
  const templates = await getAllTemplates();
  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    streamCount: template.stream.length,
    locationCount: template.location.length,
    functionCount: template.function.length,
    departmentCount: template.department.length,
  }));
}

export async function getTemplateById(id: string): Promise<AttributeTemplate | null> {
  await delay(150);
  return await getAttributeTemplateById(id);
}

export async function createScanner(data: CreateScannerDto): Promise<ScannerDetail> {
  await delay(250);

  const template = await resolveTemplateSnapshot(data.attributeTemplateId);
  const scannerId = createId('scanner');
  const draftVersion = createVersion(
    scannerId,
    1,
    data.attributeTemplateId,
    template?.name,
    template,
    createDefaultCategories(),
    'draft',
    null
  );

  const scanner: StoredScanner = {
    id: scannerId,
    name: clone(data.name),
    description: data.description ? clone(data.description) : undefined,
    status: 'draft',
    createdAt: draftVersion.createdAt,
    updatedAt: draftVersion.updatedAt,
    versions: [draftVersion],
  };

  scanners = [scanner, ...scanners];
  return toScannerDetail(scanner);
}

export async function saveScannerDraft(
  scannerId: string,
  data: SaveScannerDraftDto
): Promise<ScannerDetail> {
  await delay(250);
  const scanner = findScanner(scannerId);
  const draft = scanner.versions.find((version) => version.status === 'draft');

  if (!draft) {
    throw new Error('Create a new version before editing this scanner.');
  }

  const template = await resolveTemplateSnapshot(data.attributeTemplateId);
  draft.attributeTemplateId = data.attributeTemplateId;
  draft.attributeTemplateName = template?.name;
  draft.attributeTemplateSnapshot = template ? clone(template) : null;
  draft.categories = clone(data.categories);
  draft.updatedAt = new Date().toISOString();

  scanner.name = clone(data.name);
  scanner.description = data.description ? clone(data.description) : undefined;
  scanner.updatedAt = draft.updatedAt;

  return toScannerDetail(scanner);
}

export async function validateDraft(scannerId: string): Promise<ValidationResult> {
  await delay(120);
  const scanner = findScanner(scannerId);
  const draft = scanner.versions.find((version) => version.status === 'draft');

  if (!draft) {
    return {
      isValid: false,
      issues: [
        {
          code: 'DRAFT_NOT_FOUND',
          level: 'scanner',
          path: 'scanner.draftVersion',
          message: 'No editable draft exists for this scanner.',
          blocking: true,
        },
      ],
    };
  }

  return validateScannerDraft(
    {
      name: scanner.name,
      description: scanner.description,
      attributeTemplateId: draft.attributeTemplateId,
      categories: draft.categories,
    },
    draft.attributeTemplateSnapshot
  );
}

export async function publishScanner(scannerId: string): Promise<ScannerDetail> {
  await delay(300);
  const scanner = findScanner(scannerId);
  const draft = scanner.versions.find((version) => version.status === 'draft');

  if (!draft) {
    throw new Error('No draft version found to publish.');
  }

  const validation = await validateDraft(scannerId);
  if (!validation.isValid) {
    throw new Error('Scanner cannot be published until all validation issues are resolved.');
  }

  scanner.versions = scanner.versions.map((version) => {
    if (version.id !== draft.id) {
      return version;
    }

    return {
      ...version,
      status: 'published',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attributeTemplateSnapshot: version.attributeTemplateSnapshot
        ? clone(version.attributeTemplateSnapshot)
        : null,
      categories: clone(version.categories),
    };
  });

  scanner.status = 'published';
  scanner.updatedAt = new Date().toISOString();

  return toScannerDetail(scanner);
}

export async function createNewVersion(scannerId: string): Promise<ScannerDetail> {
  await delay(250);
  const scanner = findScanner(scannerId);

  if (scanner.versions.some((version) => version.status === 'draft')) {
    return toScannerDetail(scanner);
  }

  const latestPublished = scanner.versions
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];

  if (!latestPublished) {
    throw new Error('No published version exists to clone.');
  }

  const nextVersionNumber = latestPublished.versionNumber + 1;
  const newDraft = createVersion(
    scanner.id,
    nextVersionNumber,
    latestPublished.attributeTemplateId,
    latestPublished.attributeTemplateName,
    latestPublished.attributeTemplateSnapshot,
    latestPublished.categories,
    'draft',
    latestPublished.id
  );

  scanner.versions.push(newDraft);
  scanner.updatedAt = newDraft.updatedAt;
  return toScannerDetail(scanner);
}

export async function getScannerVersions(scannerId: string): Promise<ScannerVersionSummary[]> {
  await delay(180);
  const scanner = findScanner(scannerId);
  return scanner.versions
    .slice()
    .sort((left, right) => right.versionNumber - left.versionNumber)
    .map(toVersionSummary);
}

export async function archiveScanner(scannerId: string): Promise<ScannerDetail> {
  await delay(200);
  const scanner = findScanner(scannerId);
  scanner.status = 'archived';
  scanner.updatedAt = new Date().toISOString();
  return toScannerDetail(scanner);
}
