import 'server-only';

import { rm } from 'node:fs/promises';
import type {
  Clinic,
  ClinicStatus,
  CreateClinicDto,
  DeleteClinicConsequences,
  UpdateClinicDto,
  WorkingHoursEntry,
} from './types';
import {
  createClinicId,
  getClinicStatusMeta,
  normalizeClinicSlugInput,
  validateClinicName,
  validateClinicSlug,
  validateClinicStatusTransition,
} from './utils';
import {
  ensureClinicModuleIndexes,
  getClinicListData,
  getClinicDocumentById,
  getClinicDocumentBySlug,
  insertClinicDocument,
  updateClinicDocument,
  deleteClinicDocument,
  type ClinicDocument,
} from '@/server/clinic/repository';
import { getClinicAssetPaths } from '@/lib/uploads/clinic-assets';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * Normalize a URL by prepending https:// if no protocol is present.
 * This lets administrators type "clinic.com" without manually adding "https://".
 */
function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

function toClinic(doc: ClinicDocument): Clinic {
  return {
    id: doc.id,
    slug: doc.slug,
    name: doc.name,
    nameAr: doc.nameAr ?? null,
    cardImage: doc.cardImage ?? null,
    logo: doc.logo ?? null,
    coverImage: doc.coverImage ?? null,
    gallery: doc.gallery ?? null,
    phone: doc.phone ?? null,
    email: doc.email ?? null,
    website: doc.website ?? null,
    address: doc.address ?? null,
    addressAr: doc.addressAr ?? null,
    coordinates: doc.coordinates ?? null,
    googleMapsUrl: doc.googleMapsUrl ?? null,
    description: doc.description ?? null,
    descriptionAr: doc.descriptionAr ?? null,
    workingHours: doc.workingHours ?? null,
    workingHoursAr: doc.workingHoursAr ?? null,
    acceptsInPerson: doc.acceptsInPerson ?? true,
    redirectUrl: doc.redirectUrl ?? null,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    archivedAt: doc.archivedAt ?? null,
  };
}

function normalizeClinicDocument(doc: ClinicDocument): ClinicDocument {
  return {
    ...doc,
    nameAr: trimOrNull(doc.nameAr),
    cardImage: doc.cardImage ?? null,
    logo: doc.logo ?? null,
    coverImage: doc.coverImage ?? null,
    gallery: doc.gallery ?? null,
    phone: trimOrNull(doc.phone),
    email: trimOrNull(doc.email),
    website: trimOrNull(doc.website),
    address: trimOrNull(doc.address),
    addressAr: trimOrNull(doc.addressAr),
    coordinates: doc.coordinates ?? null,
    googleMapsUrl: trimOrNull(doc.googleMapsUrl),
    description: trimOrNull(doc.description),
    descriptionAr: trimOrNull(doc.descriptionAr),
    workingHours: doc.workingHours ?? null,
    workingHoursAr: doc.workingHoursAr ?? null,
    acceptsInPerson: doc.acceptsInPerson ?? true,
    redirectUrl: trimOrNull(doc.redirectUrl),
    archivedAt: doc.archivedAt ?? null,
  };
}

function buildWorkingHours(
  input: WorkingHoursEntry[] | null | undefined,
): WorkingHoursEntry[] | null {
  if (!input) return null;
  const cleaned = input.map((entry) => ({
    day: entry.day.trim(),
    hours: entry.hours.trim(),
  }));
  return cleaned.length > 0 ? cleaned : null;
}

function assertUniqueSlug(
  clinics: ClinicDocument[],
  slug: string,
  excludeClinicId?: string,
): void {
  const duplicate = clinics.find(
    (c) => c.slug === slug && c.id !== excludeClinicId,
  );
  if (duplicate) {
    throw new Error(`Slug "${slug}" is already in use by another clinic.`);
  }
}

function buildPartialUpdates(
  data: UpdateClinicDto,
  normalized: ClinicDocument,
  now: string,
  nextStatus?: ClinicStatus,
): Partial<ClinicDocument> {
  const next = { ...normalized };

  if (data.name !== undefined) next.name = data.name.trim();
  if (data.nameAr !== undefined) next.nameAr = trimOrNull(data.nameAr);
  if (data.slug !== undefined) next.slug = normalizeClinicSlugInput(data.slug);
  if (data.cardImage !== undefined) next.cardImage = data.cardImage;
  if (data.logo !== undefined) next.logo = data.logo;
  if (data.coverImage !== undefined) next.coverImage = data.coverImage;
  if (data.phone !== undefined) next.phone = trimOrNull(data.phone);
  if (data.email !== undefined) next.email = trimOrNull(data.email);
  if (data.website !== undefined) next.website = normalizeUrl(data.website);
  if (data.address !== undefined) next.address = trimOrNull(data.address);
  if (data.addressAr !== undefined) next.addressAr = trimOrNull(data.addressAr);
  if (data.coordinates !== undefined) next.coordinates = data.coordinates;
  if (data.googleMapsUrl !== undefined) next.googleMapsUrl = trimOrNull(data.googleMapsUrl);
  if (data.description !== undefined) next.description = trimOrNull(data.description);
  if (data.descriptionAr !== undefined) next.descriptionAr = trimOrNull(data.descriptionAr);
  if (data.workingHours !== undefined) next.workingHours = buildWorkingHours(data.workingHours);
  if (data.workingHoursAr !== undefined) next.workingHoursAr = buildWorkingHours(data.workingHoursAr);
  if (data.acceptsInPerson !== undefined) next.acceptsInPerson = data.acceptsInPerson;
  if (data.redirectUrl !== undefined) next.redirectUrl = normalizeUrl(data.redirectUrl);

  next.updatedAt = now;
  next.archivedAt = nextStatus === 'archived' ? now : (normalized.archivedAt ?? null);

  return next;
}

export async function getAllClinics(): Promise<Clinic[]> {
  await ensureClinicModuleIndexes();
  const data = await getClinicListData();
  return data.clinics.map(normalizeClinicDocument).map(toClinic);
}

export async function getClinicById(id: string): Promise<Clinic | null> {
  await ensureClinicModuleIndexes();
  const doc = await getClinicDocumentById(id);
  return doc ? toClinic(normalizeClinicDocument(doc)) : null;
}

export async function getClinicBySlug(slug: string): Promise<Clinic | null> {
  await ensureClinicModuleIndexes();
  const normalized = normalizeClinicSlugInput(slug);
  const doc = await getClinicDocumentBySlug(normalized);
  return doc ? toClinic(normalizeClinicDocument(doc)) : null;
}

export async function createClinic(data: CreateClinicDto): Promise<Clinic> {
  await ensureClinicModuleIndexes();
  const listData = await getClinicListData();

  const nameError = validateClinicName(data.name);
  if (nameError) throw new Error(nameError);

  const slugValidation = validateClinicSlug(data.slug);
  if (slugValidation.errors.length > 0) {
    throw new Error(slugValidation.errors[0]);
  }

  assertUniqueSlug(listData.clinics, slugValidation.normalized);

  const now = new Date().toISOString();
  const status: ClinicStatus = data.status ?? 'inactive';

  const doc: ClinicDocument = {
    id: createClinicId(slugValidation.normalized),
    slug: slugValidation.normalized,
    name: data.name.trim(),
    nameAr: trimOrNull(data.nameAr),
    cardImage: data.cardImage ?? null,
    logo: data.logo ?? null,
    coverImage: data.coverImage ?? null,
    gallery: null,
    phone: trimOrNull(data.phone),
    email: trimOrNull(data.email),
    website: normalizeUrl(data.website),
    address: trimOrNull(data.address),
    addressAr: trimOrNull(data.addressAr),
    coordinates: data.coordinates ?? null,
    googleMapsUrl: trimOrNull(data.googleMapsUrl),
    description: trimOrNull(data.description),
    descriptionAr: trimOrNull(data.descriptionAr),
    workingHours: buildWorkingHours(data.workingHours),
    workingHoursAr: buildWorkingHours(data.workingHoursAr),
    acceptsInPerson: data.acceptsInPerson ?? true,
    redirectUrl: normalizeUrl(data.redirectUrl),
    status,
    createdAt: now,
    updatedAt: now,
    archivedAt: status === 'archived' ? now : null,
  };

  await insertClinicDocument(doc);
  const created = await getClinicById(doc.id);
  if (!created) throw new Error('Clinic was created but could not be loaded.');
  return created;
}

export async function updateClinic(
  id: string,
  data: UpdateClinicDto,
): Promise<Clinic> {
  await ensureClinicModuleIndexes();
  const current = await getClinicDocumentById(id);
  if (!current) throw new Error('Clinic not found.');

  if (current.status === 'archived') {
    throw new Error('Archived clinics cannot be modified.');
  }

  const listData = await getClinicListData();
  const normalized = normalizeClinicDocument(current);

  const nextSlug = data.slug !== undefined
    ? normalizeClinicSlugInput(data.slug)
    : normalized.slug;
  const nextStatus = data.status ?? normalized.status;

  if (data.slug !== undefined) {
    const slugValidation = validateClinicSlug(data.slug);
    if (slugValidation.errors.length > 0) {
      throw new Error(slugValidation.errors[0]);
    }
    assertUniqueSlug(listData.clinics, slugValidation.normalized, id);
  }

  if (data.status) {
    const err = validateClinicStatusTransition(normalized.status, data.status);
    if (err) throw new Error(err);
  }

  const now = new Date().toISOString();
  const updates = buildPartialUpdates(data, normalized, now, nextStatus);
  updates.status = nextStatus;

  const updated = await updateClinicDocument(id, updates);
  if (!updated) throw new Error('Clinic update failed.');
  return toClinic(normalizeClinicDocument(updated));
}

export async function archiveClinic(id: string): Promise<Clinic> {
  return updateClinic(id, { status: 'archived' });
}

export async function restoreClinic(id: string): Promise<Clinic> {
  return updateClinic(id, { status: 'inactive' });
}

export async function previewDeleteClinic(
  clinicId: string,
): Promise<DeleteClinicConsequences> {
  await ensureClinicModuleIndexes();
  const doc = await getClinicDocumentById(clinicId);
  if (!doc) throw new Error('Clinic not found.');

  return {
    clinicId: doc.id,
    slug: doc.slug,
    name: doc.name,
    status: doc.status,
  };
}

export async function deleteClinic(
  clinicId: string,
  confirmation?: { slug: string },
): Promise<void> {
  await ensureClinicModuleIndexes();
  const doc = await getClinicDocumentById(clinicId);
  if (!doc) throw new Error('Clinic not found.');

  if (!confirmation || confirmation.slug.trim() !== doc.slug) {
    throw new Error(`Type the clinic slug "${doc.slug}" to confirm deletion.`);
  }

  try {
    const { tenantDirectoryPath } = await getClinicAssetPaths(doc.slug);
    await rm(tenantDirectoryPath, { recursive: true, force: true });
  } catch {
    // Asset directory may not exist
  }

  await deleteClinicDocument(clinicId);
}

export async function updateClinicBranding(
  id: string,
  branding: { logo?: string | null; coverImage?: string | null },
): Promise<Clinic> {
  return updateClinic(id, branding);
}
