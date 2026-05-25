import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { normalizeTenantSlugInput, validateTenantSlug } from '@/modules/tenant/utils';
import type { BrandingConfig } from '@/types/branding';

type TenantAssetKind = 'logo' | 'background';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const TENANT_ASSET_ROOT = path.resolve(process.cwd(), 'public', 'assets', 'tenants');
const ALLOWED_EXTENSIONS_BY_MIME = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
]);

function assertSafeTenantSlug(rawTenantSlug: string): string {
  const normalized = normalizeTenantSlugInput(rawTenantSlug);
  const validation = validateTenantSlug(normalized);

  if (!normalized || validation.errors.length > 0) {
    throw new Error(validation.errors[0] ?? 'Tenant slug is invalid.');
  }

  return normalized;
}

function getTenantAssetDirectoryPath(tenantSlug: string): string {
  const sanitizedSlug = assertSafeTenantSlug(tenantSlug);
  const directoryPath = path.resolve(TENANT_ASSET_ROOT, sanitizedSlug);

  if (!directoryPath.startsWith(TENANT_ASSET_ROOT)) {
    throw new Error('Resolved tenant asset path is invalid.');
  }

  return directoryPath;
}

function getFileExtension(file: File): string {
  const extensionFromMime = ALLOWED_EXTENSIONS_BY_MIME.get(file.type.toLowerCase());
  if (extensionFromMime) {
    return extensionFromMime;
  }

  const rawExtension = path.extname(file.name).toLowerCase().replace('.', '');
  const normalizedByName =
    rawExtension === 'jpeg' ? 'jpg' : rawExtension;

  if (!['png', 'jpg', 'webp'].includes(normalizedByName)) {
    throw new Error('Unsupported image format. Use PNG, JPG, JPEG, or WEBP.');
  }

  return normalizedByName;
}

async function removeExistingAssetVariants(
  directoryPath: string,
  baseName: string,
): Promise<void> {
  const knownExtensions = ['png', 'jpg', 'jpeg', 'webp'];

  await Promise.all(
    knownExtensions.map(async (extension) => {
      const assetPath = path.join(directoryPath, `${baseName}.${extension === 'jpeg' ? 'jpg' : extension}`);
      await fs.rm(assetPath, { force: true });
    }),
  );
}

async function writeTenantAsset(
  tenantSlug: string,
  file: File,
  kind: TenantAssetKind,
): Promise<string> {
  if (!(file instanceof File)) {
    throw new Error('A valid image file is required.');
  }

  if (file.size <= 0) {
    throw new Error('Uploaded image is empty.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Uploaded image exceeds the 5MB limit.');
  }

  const extension = getFileExtension(file);
  const directoryPath = await ensureTenantAssetDirectory(tenantSlug);
  const baseName = kind === 'logo' ? 'logo' : 'background';

  await removeExistingAssetVariants(directoryPath, baseName);

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const targetFileName = `${baseName}.${extension}`;
  const targetPath = path.join(directoryPath, targetFileName);
  await fs.writeFile(targetPath, fileBuffer);

  return `/assets/tenants/${assertSafeTenantSlug(tenantSlug)}/${targetFileName}`;
}

export async function ensureTenantAssetDirectory(tenantSlug: string): Promise<string> {
  const directoryPath = getTenantAssetDirectoryPath(tenantSlug);
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

export async function saveTenantLogo(tenantSlug: string, file: File): Promise<string> {
  return writeTenantAsset(tenantSlug, file, 'logo');
}

export async function saveTenantBackground(tenantSlug: string, file: File): Promise<string> {
  return writeTenantAsset(tenantSlug, file, 'background');
}

export function getTenantAssetPaths(tenantSlug: string): {
  logoBasePath: string;
  backgroundBasePath: string;
  tenantDirectoryPath: string;
  tenantPublicBasePath: string;
} {
  const sanitizedSlug = assertSafeTenantSlug(tenantSlug);

  return {
    logoBasePath: `/assets/tenants/${sanitizedSlug}/logo`,
    backgroundBasePath: `/assets/tenants/${sanitizedSlug}/background`,
    tenantDirectoryPath: getTenantAssetDirectoryPath(sanitizedSlug),
    tenantPublicBasePath: `/assets/tenants/${sanitizedSlug}`,
  };
}

export async function syncTenantAssetDirectory(
  previousTenantSlug: string,
  nextTenantSlug: string,
): Promise<void> {
  const previousSlug = assertSafeTenantSlug(previousTenantSlug);
  const nextSlug = assertSafeTenantSlug(nextTenantSlug);

  if (previousSlug === nextSlug) {
    await ensureTenantAssetDirectory(nextSlug);
    return;
  }

  const previousDirectory = getTenantAssetDirectoryPath(previousSlug);
  const nextDirectory = await ensureTenantAssetDirectory(nextSlug);
  const previousExists = await fs.stat(previousDirectory).then(() => true).catch(() => false);

  if (!previousExists) {
    return;
  }

  const nextExists = await fs.stat(nextDirectory).then(() => true).catch(() => false);
  if (!nextExists) {
    await fs.rename(previousDirectory, nextDirectory);
    return;
  }

  const entries = await fs.readdir(previousDirectory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const sourcePath = path.join(previousDirectory, entry.name);
    const destinationPath = path.join(nextDirectory, entry.name);
    await fs.rm(destinationPath, { force: true });
    await fs.rename(sourcePath, destinationPath);
  }

  await fs.rm(previousDirectory, { recursive: true, force: true });
}

function replaceTenantAssetSlug(
  assetPath: string | undefined,
  previousSlug: string,
  nextSlug: string,
): string | undefined {
  if (!assetPath) {
    return assetPath;
  }

  const previousBase = `/assets/tenants/${previousSlug}/`;
  if (!assetPath.startsWith(previousBase)) {
    return assetPath;
  }

  return assetPath.replace(previousBase, `/assets/tenants/${nextSlug}/`);
}

export function rebaseTenantBrandingAssetPaths(
  branding: BrandingConfig | null | undefined,
  previousTenantSlug: string,
  nextTenantSlug: string,
): BrandingConfig {
  const previousSlug = assertSafeTenantSlug(previousTenantSlug);
  const nextSlug = assertSafeTenantSlug(nextTenantSlug);

  return {
    ...(branding ?? {}),
    logo: replaceTenantAssetSlug(branding?.logo, previousSlug, nextSlug),
    logoUrl: replaceTenantAssetSlug(branding?.logoUrl, previousSlug, nextSlug),
    backgroundImage: replaceTenantAssetSlug(branding?.backgroundImage, previousSlug, nextSlug),
  };
}
