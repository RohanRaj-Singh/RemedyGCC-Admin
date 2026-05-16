/**
 * Scanner Service
 * Strict admin-side scanner builder domain with MongoDB persistence.
 * Scanner is now fully decoupled from Attribute Template - composition happens at Tenant level.
 */

'use server';

import { Category, CreateScannerDto, DuplicateScannerDto, LocalizedText, SaveScannerDraftDto, Scanner, ScannerDetail, ScannerFollowUpTrigger, ScannerStatus, ScannerVersion, ScannerVersionSummary, ScannerVersionStats, TemplateOption, ValidationResult } from './types';
import { validateScannerDraft } from './utils/validation';
import { createDefaultCategories, createId } from './utils/builder';
import { detectScannerChanges, checkSubmissionProtection, type ChangeImpact } from './utils/change-impact';
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
    isActive: version.isActive,
    sourceVersionId: version.sourceVersionId,
    responseCount: version.responseCount,
    publishedAt: version.publishedAt,
    archivedAt: version.archivedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    isImmutable: version.status === 'published' || version.status === 'archived',
  };
}

function computeVersionStats(versions: ScannerVersion[]): ScannerVersionStats {
  return {
    total: versions.length,
    draft: versions.filter(v => v.status === 'draft').length,
    published: versions.filter(v => v.status === 'published').length,
    archived: versions.filter(v => v.status === 'archived').length,
  };
}

function findActiveVersion(versions: ScannerVersion[]): ScannerVersion | null {
  return versions.find(v => v.isActive) ?? null;
}

function toScannerSummary(scanner: ScannerDocument): Scanner {
  const activeVersion = findActiveVersion(scanner.versions);
  const publishedVersion = scanner.versions
    .filter((version) => version.status === 'published')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;

  const draftVersion = scanner.versions
    .filter((version) => version.status === 'draft')
    .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;

  const categories = activeVersion?.categories ?? publishedVersion?.categories ?? draftVersion?.categories ?? [];
  const subdomainCount = categories.reduce((total, category) => total + category.subdomains.length, 0);
  const questionCount = categories.reduce(
    (total, category) =>
      total + category.subdomains.reduce((subTotal, subdomain) => subTotal + subdomain.questions.length, 0),
    0
  );

  const lastPublished = scanner.versions
    .filter((v) => v.publishedAt)
    .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))[0];

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
    activeVersionId: activeVersion?.id ?? null,
    categoryCount: categories.length,
    subdomainCount,
    questionCount,
    hasResponses: scanner.versions.some((version) => version.responseCount > 0),
    hasUnpublishedChanges:
      Boolean(draftVersion) &&
      (!publishedVersion || draftVersion.versionNumber !== publishedVersion.versionNumber),
    versionStats: computeVersionStats(scanner.versions),
    lastPublishedAt: lastPublished?.publishedAt ?? null,
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
  const activeVersion = findActiveVersion(scanner.versions);

  return {
    ...summary,
    draftVersion: draftVersion ? clone(draftVersion) : null,
    publishedVersion: publishedVersion ? clone(publishedVersion) : null,
    activeVersion: activeVersion ? clone(activeVersion) : null,
    versions: scanner.versions
      .slice()
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .map(toVersionSummary),
  };
}

function createVersion(
  scannerId: string,
  versionNumber: number,
  categories: Category[],
  followUpTriggers: ScannerFollowUpTrigger[],
  status: ScannerVersion['status'],
  sourceVersionId: string | null,
  isActive = false,
  responseCount = 0,
  publishedAt?: string,
  archivedAt?: string
): ScannerVersion {
  const now = new Date().toISOString();
  return {
    id: createId('scanner-version'),
    scannerId,
    versionNumber,
    status,
    isActive,
    sourceVersionId,
    categories: clone(categories),
    followUpTriggers: clone(followUpTriggers),
    responseCount,
    publishedAt,
    archivedAt,
    createdAt: now,
    updatedAt: now,
  };
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
  return [];
}

export async function getTemplateById(id: string): Promise<null> {
  return null;
}

export async function createScanner(data: CreateScannerDto): Promise<ScannerDetail> {
  const scannerId = createId('scanner');
  const draftVersion = createVersion(
    scannerId,
    1,
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
    activeVersionId: null,
    categoryCount: 5,
    subdomainCount: 0,
    questionCount: 0,
    hasResponses: false,
    hasUnpublishedChanges: true,
    versionStats: { total: 1, draft: 1, published: 0, archived: 0 },
    lastPublishedAt: null,
    createdAt: draftVersion.createdAt,
    updatedAt: draftVersion.updatedAt,
  };

  const document = await insertScannerDocument(scannerBase, draftVersion);
  return toScannerDetail(document);
}

export async function saveScannerDraft(
  scannerId: string,
  data: SaveScannerDraftDto,
  checkBreakingChanges = true
): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  const draft = document.versions.find((version) => version.status === 'draft');
  if (!draft) {
    throw new Error('Create a new version before editing this scanner.');
  }

  // Check for breaking changes if requested and scanner has responses
  if (checkBreakingChanges && document.hasResponses) {
    const changeResult = detectScannerChanges(draft, {
      ...draft,
      categories: data.categories,
      followUpTriggers: data.followUpTriggers,
    } as ScannerVersion);

    const protection = checkSubmissionProtection(
      document.versions.reduce((sum, v) => sum + v.responseCount, 0),
      changeResult.impacts
    );

    if (protection.protected && !changeResult.canSave) {
      throw new Error(
        `BLOCKED: This scanner has existing submissions. Breaking changes are not allowed. ` +
        `Please duplicate the scanner to make structural changes. ` +
        `Blocking issues: ${protection.blockingImpacts.map(i => i.message).join('; ')}`
      );
    }
  }

  const now = new Date().toISOString();

  const versionUpdates: Partial<ScannerVersionDocument> = {
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

/**
 * Analyze scanner changes without saving - useful for UI warnings
 */
export async function analyzeScannerChanges(
  _beforeVersion: ScannerVersion,
  _afterCategories: Category[],
  _afterFollowUpTriggers: ScannerFollowUpTrigger[]
): Promise<ReturnType<typeof detectScannerChanges>> {
  // This is a sync operation but wrapped in async for server action compatibility
  // In a real implementation, this would analyze the changes client-side or via a separate non-server module
  return {
    hasChanges: false,
    impacts: [],
    canSave: true,
    requiresDuplicate: false,
  };
}

/**
 * Check if saving would be blocked due to breaking changes
 */
export async function checkSaveProtection(
  _responseCount: number,
  _impacts: ChangeImpact[]
): Promise<{ blocked: boolean; message?: string }> {
  // This is handled client-side via change-impact.ts
  return { blocked: false };
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
      categories: draft.categories,
      followUpTriggers: draft.followUpTriggers,
    },
    null
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

export async function duplicateScanner(data: DuplicateScannerDto): Promise<ScannerDetail> {
  const sourceDocument = await getScannerDetailData(data.sourceScannerId);
  if (!sourceDocument) {
    throw new Error('Source scanner not found');
  }

  const publishedVersion = sourceDocument.versions.find(v => v.status === 'published');
  const draftVersion = sourceDocument.versions.find(v => v.status === 'draft');
  const sourceVersion = publishedVersion ?? draftVersion;

  if (!sourceVersion) {
    throw new Error('Source scanner has no version to duplicate');
  }

  const scannerId = createId('scanner');
  const newDraft = createVersion(
    scannerId,
    1,
    sourceVersion.categories,
    sourceVersion.followUpTriggers,
    'draft',
    null
  );

  const scannerBase: Omit<ScannerDocument, 'versions'> = {
    id: scannerId,
    name: clone(data.newName),
    description: data.newDescription ? clone(data.newDescription) : undefined,
    status: 'draft',
    latestVersionNumber: 1,
    activeVersionId: null,
    categoryCount: sourceDocument.categoryCount,
    subdomainCount: sourceDocument.subdomainCount,
    questionCount: sourceDocument.questionCount,
    hasResponses: false,
    hasUnpublishedChanges: true,
    versionStats: { total: 1, draft: 1, published: 0, archived: 0 },
    duplicatedFromScannerId: data.sourceScannerId,
    lastPublishedAt: null,
    createdAt: newDraft.createdAt,
    updatedAt: newDraft.updatedAt,
  };

  const document = await insertScannerDocument(scannerBase, newDraft);
  return toScannerDetail(document);
}

export async function archiveVersion(scannerId: string, versionId: string): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  const version = document.versions.find(v => v.id === versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.isActive) {
    throw new Error('Cannot archive the active version. Activate another version first.');
  }

  if (version.status === 'draft') {
    throw new Error('Cannot archive a draft version.');
  }

  const now = new Date().toISOString();
  const updatedDocument = await updateScannerDraftDocument(
    scannerId,
    versionId,
    {},
    { status: 'archived', archivedAt: now, updatedAt: now }
  );

  if (!updatedDocument) {
    throw new Error('Failed to archive version');
  }

  return toScannerDetail(updatedDocument);
}

export async function activateVersion(scannerId: string, versionId: string): Promise<ScannerDetail> {
  const document = await getScannerDetailData(scannerId);
  if (!document) {
    throw new Error('Scanner not found');
  }

  const version = document.versions.find(v => v.id === versionId);
  if (!version) {
    throw new Error('Version not found');
  }

  if (version.status !== 'published') {
    throw new Error('Only published versions can be activated.');
  }

  const now = new Date().toISOString();

  for (const v of document.versions) {
    if (v.isActive && v.id !== versionId) {
      await updateScannerDraftDocument(scannerId, v.id, {}, { isActive: false, updatedAt: now });
    }
  }

  const updatedDocument = await updateScannerDraftDocument(scannerId, versionId, {}, { isActive: true, updatedAt: now });

  if (!updatedDocument) {
    throw new Error('Failed to activate version');
  }

  return toScannerDetail(updatedDocument);
}
