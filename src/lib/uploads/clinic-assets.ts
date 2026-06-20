import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { normalizeClinicSlugInput, validateClinicSlug } from '@/modules/clinic/utils';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const CLINIC_ASSET_ROOT = path.resolve(process.cwd(), 'public', 'assets', 'clinics');
const ALLOWED_EXTENSIONS_BY_MIME = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
]);

export function assertSafeClinicSlug(rawSlug: string): string {
  const normalized = normalizeClinicSlugInput(rawSlug);
  const validation = validateClinicSlug(normalized);

  if (!normalized || validation.errors.length > 0) {
    throw new Error(validation.errors[0] ?? 'Clinic slug is invalid.');
  }

  return normalized;
}

function getClinicAssetDirectoryPath(clinicSlug: string): string {
  const sanitized = assertSafeClinicSlug(clinicSlug);
  const dirPath = path.resolve(CLINIC_ASSET_ROOT, sanitized);

  if (!dirPath.startsWith(CLINIC_ASSET_ROOT)) {
    throw new Error('Resolved clinic asset path is invalid.');
  }

  return dirPath;
}

function getFileExtension(file: File): string {
  const fromMime = ALLOWED_EXTENSIONS_BY_MIME.get(file.type.toLowerCase());
  if (fromMime) return fromMime;

  const raw = path.extname(file.name).toLowerCase().replace('.', '');
  return raw === 'jpeg' ? 'jpg' : raw;
}

async function saveAssetFile(
  clinicSlug: string,
  file: File,
  filename: string,
): Promise<string> {
  const dir = getClinicAssetDirectoryPath(clinicSlug);
  await fs.mkdir(dir, { recursive: true });

  const ext = getFileExtension(file);
  const fullPath = path.join(dir, `${filename}.${ext}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  return `/assets/clinics/${clinicSlug}/${filename}.${ext}`;
}

export async function ensureClinicAssetDirectory(clinicSlug: string): Promise<void> {
  const dir = getClinicAssetDirectoryPath(clinicSlug);
  await fs.mkdir(dir, { recursive: true });
}

export async function saveClinicLogo(clinicSlug: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Logo file must be under 5 MB.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Logo must be an image file.');
  }

  return saveAssetFile(clinicSlug, file, 'logo');
}

export async function saveClinicCoverImage(clinicSlug: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Cover image must be under 5 MB.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Cover image must be an image file.');
  }

  return saveAssetFile(clinicSlug, file, 'cover');
}

export async function saveClinicGalleryImage(clinicSlug: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Gallery images must be under 5 MB each.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Gallery images must be image files.');
  }

  const ts = Date.now().toString(36);
  const sanitizedName = path.basename(file.name, path.extname(file.name))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);

  return saveAssetFile(clinicSlug, file, `gallery_${ts}_${sanitizedName}`);
}

export async function resolveClinicAssetPath(
  clinicSlug: string,
  currentValue: string | null | undefined,
  fallback: string,
): Promise<string | null> {
  if (!currentValue) return null;

  try {
    const dir = getClinicAssetDirectoryPath(clinicSlug);
    const filename = path.basename(currentValue);
    const filePath = path.join(dir, filename);

    await fs.access(filePath);
    return currentValue;
  } catch {
    return fallback;
  }
}

export async function getClinicAssetPaths(clinicSlug: string) {
  return {
    tenantDirectoryPath: getClinicAssetDirectoryPath(clinicSlug),
  };
}
