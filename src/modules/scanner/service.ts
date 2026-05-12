/**
 * Scanner Service
 * Strict admin-side scanner builder domain with MongoDB persistence.
 */

'use server';

import { getAllTemplates, getTemplateById as getAttributeTemplateById } from '../attribute-template/service';
import { AttributeTemplate } from '../attribute-template/types';
import { Category, CreateScannerDto, LocalizedText, SaveScannerDraftDto, Scanner, ScannerDetail, ScannerFollowUpTrigger, ScannerStatus, ScannerVersion, ScannerVersionSummary, TemplateOption, ValidationResult } from './types';
import { validateScannerDraft } from './utils/validation';
import { createDefaultCategories, createId } from './utils/builder';
import {
  getScannersListData,
  getScannerDetailData,
  insertScannerDocument,
  updateScannerDraftDocument,
  publishScannerVersionDocument,
  archiveScannerDocument,
  createNewDraftVersionDocument,
  ScannerDocument,
  ScannerVersionDocument
} from '../../server/scanner/repository';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function resolveVersionForSummary(scanner: ScannerDocument): ScannerVersionDocument | null {
  return scanner.versions.find((version) => version.status === 'draft')
    ?? scanner.versions.find((version) => version.status === 'published')
    ?? null;
}

function toScannerSummary(scanner: ScannerDocument): Scanner {
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

function toScannerDetail(scanner: ScannerDocument): ScannerDetail {
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
  followUpTriggers: ScannerFollowUpTrigger[],
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
    followUpTriggers: clone(followUpTriggers),
    responseCount,
    publishedAt,
    createdAt: now,
    updatedAt: now,
  };
}

async function resolveTemplateSnapshot(attributeTemplateId: string) {
  return await getAttributeTemplateById(attributeTemplateId);
}

export async function getScanners(): Promise<Scanner[]> {
  const documents = await getScannersListData();
  return documents.map(toScannerSummary);
}

export async function getScannerById(id: string): Promise<ScannerDetail | null> {
  const document = await getScannerDetailData(id);
  return document ? toScannerDetail(document) : null;
}

export async function getTemplates(): Promise<TemplateOption[]> {
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
  return await getAttributeTemplateById(id);
}

export async function createScanner(data: CreateScannerDto): Promise<ScannerDetail> {
  const template = await resolveTemplateSnapshot(data.attributeTemplateId);
  const scannerId = createId('scanner');
  const draftVersion = createVersion(
    scannerId,
    1,
    data.attributeTemplateId,
    template?.name,
    template,
    createDefaultCategories(),
    [],
    'draft',
    null
  );

  const scannerBase: Omit<ScannerDocument, 'versions'> = {
    id: scannerId,
    name: clone(data.name),
    description: data.description ? clone(data.description) : undefined,
    status: 'draft',
    latestVersionNumber: 1,
    attributeTemplateId: data.attributeTemplateId,
    attributeTemplateName: template?.name,
    categoryCount: 5,
    subdomainCount: 0,
    questionCount: 0,
    hasResponses: false,
    hasUnpublishedChanges: true,
    createdAt: draftVersion.createdAt,
    updatedAt: draftVersion.updatedAt,
  };

  const document = await insertScannerDocument(scannerBase, draftVersion);
  return toScannerDetail(document);
}

export async function saveScannerDraft(
  scannerId: string,
  data: SaveScannerDraftDto
): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  const draft = document.versions.find((version) => version.status === 'draft');
  if (!draft) {
    throw new Error('Create a new version before editing this scanner.');
  }

  const template = await resolveTemplateSnapshot(data.attributeTemplateId);
  const now = new Date().toISOString();

  const versionUpdates: Partial<ScannerVersionDocument> = {
    attributeTemplateId: data.attributeTemplateId,
    attributeTemplateName: template?.name,
    attributeTemplateSnapshot: template ? clone(template) : null,
    categories: clone(data.categories),
    followUpTriggers: clone(data.followUpTriggers),
    updatedAt: now,
  };

  const scannerUpdates: Partial<Omit<ScannerDocument, 'versions'>> = {
    name: clone(data.name),
    description: data.description ? clone(data.description) : undefined,
    updatedAt: now,
  };

  const updatedDocument = await updateScannerDraftDocument(
    scannerId,
    draft.id,
    scannerUpdates,
    versionUpdates
  );

  if (!updatedDocument) {
    throw new Error('Failed to update scanner draft');
  }

  return toScannerDetail(updatedDocument);
}

export async function validateDraft(scannerId: string): Promise<ValidationResult> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    return {
      isValid: false,
      issues: [
        {
          id: 'scanner-not-found',
          code: 'SCANNER_NOT_FOUND',
          level: 'scanner',
          severity: 'error',
          path: 'scanner',
          message: 'Scanner does not exist.',
          blocking: true,
        },
      ],
    };
  }

  const draft = document.versions.find((version) => version.status === 'draft');
  if (!draft) {
    return {
      isValid: false,
      issues: [
        {
          id: 'draft-not-found',
          code: 'DRAFT_NOT_FOUND',
          level: 'scanner',
          severity: 'error',
          path: 'scanner.draftVersion',
          message: 'No editable draft exists for this scanner.',
          blocking: true,
        },
      ],
    };
  }

  return validateScannerDraft(
    {
      name: document.name,
      description: document.description,
      attributeTemplateId: draft.attributeTemplateId,
      categories: draft.categories,
      followUpTriggers: draft.followUpTriggers,
    },
    draft.attributeTemplateSnapshot
  );
}

export async function publishScanner(scannerId: string): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  const draft = document.versions.find((version) => version.status === 'draft');
  if (!draft) {
    throw new Error('No draft version found to publish.');
  }

  const validation = await validateDraft(scannerId);
  if (!validation.isValid) {
    throw new Error('Scanner cannot be published until all validation issues are resolved.');
  }

  const now = new Date().toISOString();
  const updatedDocument = await publishScannerVersionDocument(scannerId, draft.id, now);

  if (!updatedDocument) {
    throw new Error('Failed to publish scanner version');
  }

  return toScannerDetail(updatedDocument);
}

export async function createNewVersion(scannerId: string): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  if (document.versions.some((version) => version.status === 'draft')) {
    return toScannerDetail(document);
  }

  const latestPublished = document.versions
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0];

  if (!latestPublished) {
    throw new Error('No published version exists to clone.');
  }

  const nextVersionNumber = latestPublished.versionNumber + 1;
  const newDraft = createVersion(
    document.id,
    nextVersionNumber,
    latestPublished.attributeTemplateId,
    latestPublished.attributeTemplateName,
    latestPublished.attributeTemplateSnapshot,
    latestPublished.categories,
    latestPublished.followUpTriggers,
    'draft',
    latestPublished.id
  );

  const updatedDocument = await createNewDraftVersionDocument(scannerId, newDraft);

  if (!updatedDocument) {
    throw new Error('Failed to create new draft version');
  }

  return toScannerDetail(updatedDocument);
}

export async function getScannerVersions(scannerId: string): Promise<ScannerVersionSummary[]> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    return [];
  }
  return document.versions
    .slice()
    .sort((left, right) => right.versionNumber - left.versionNumber)
    .map(toVersionSummary);
}

export async function archiveScanner(scannerId: string): Promise<ScannerDetail> {
  const updatedDocument = await archiveScannerDocument(scannerId);
  if (!updatedDocument) {
    throw new Error('Scanner not found');
  }
  return toScannerDetail(updatedDocument);
}
