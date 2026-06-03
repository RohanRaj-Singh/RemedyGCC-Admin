import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';
import { normalizeTenantSlugInput, validateTenantSlug } from '@/modules/tenant/utils';
import type { BrandingConfig } from '@/types/branding';

type TenantAssetKind = 'logo' | 'background';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const TENANT_ASSET_ROOT = path.resolve(process.cwd(), 'public', 'assets', 'tenants');
const ALLOWED_EXTENSIONS_BY_MIME = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp'],
]);

export function assertSafeTenantSlug(rawTenantSlug: string): string {
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

  // Return a route-handler URL rather than a /assets/... static path. The
  // Next.js production static handler only serves files from public/ that
  // existed at build time; files written after `next build` are not in the
  // static manifest and 404. The /api/tenant-assets/[slug]/[file] route
  // reads from disk on every request, so it works in production.
  return `/api/tenant-assets/${assertSafeTenantSlug(tenantSlug)}/${targetFileName}`;
}

export async function ensureTenantAssetDirectory(tenantSlug: string): Promise<string> {
  const directoryPath = getTenantAssetDirectoryPath(tenantSlug);
  await fs.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}

/**
 * Resolve a tenant asset path to an existing file on disk.
 *
 * If `storedPath` points at a file that exists, return it as-is. Otherwise,
 * scan the tenant's asset directory for the latest variant of `baseName`
 * (e.g. `logo.png`, `logo.webp`) and return that. If nothing exists, fall
 * back to the provided default. This prevents stale URLs (e.g. a logo that
 * was re-uploaded as a different extension, or wiped before a new one was
 * saved) from being baked into the published runtime config.
 */
export async function resolveTenantAssetPath(
  tenantSlug: string,
  baseName: 'logo' | 'background',
  storedPath: string | undefined,
  fallback: string,
): Promise<string> {
  const sanitizedSlug = assertSafeTenantSlug(tenantSlug);

  const stripLeadingSlash = (value: string) => value.replace(/^\/+/, '');

  // 1. Trust the stored path only if the file actually exists on disk.
  if (storedPath) {
    const trimmed = storedPath.trim();
    if (trimmed) {
      // Path lives outside the admin's tenant asset root (e.g. CDN URL);
      // leave it alone — we can't verify the file here.
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
        return trimmed;
      }
      const storedRelative = stripLeadingSlash(trimmed);
      const storedAbsolute = path.resolve(TENANT_ASSET_ROOT, storedRelative);
      if (storedAbsolute.startsWith(TENANT_ASSET_ROOT)) {
        const exists = await fs.stat(storedAbsolute).then(() => true).catch(() => false);
        if (exists) {
          return trimmed.startsWith('/') ? trimmed : `/${storedRelative}`;
        }
      }
    }
  }

  // 2. Look for any matching variant on disk and return the first one.
  const directoryPath = getTenantAssetDirectoryPath(sanitizedSlug);
  const knownExtensions = ['png', 'jpg', 'webp'];
  for (const extension of knownExtensions) {
    const candidateName = `${baseName}.${extension}`;
    const candidatePath = path.join(directoryPath, candidateName);
    const exists = await fs.stat(candidatePath).then(() => true).catch(() => false);
    if (exists) {
      return `/assets/tenants/${sanitizedSlug}/${candidateName}`;
    }
  }

  // 3. Nothing on disk — fall back to the supplied default asset.
  return fallback;
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
    logoBasePath: `/api/tenant-assets/${sanitizedSlug}/logo`,
    backgroundBasePath: `/api/tenant-assets/${sanitizedSlug}/background`,
    tenantDirectoryPath: getTenantAssetDirectoryPath(sanitizedSlug),
    tenantPublicBasePath: `/api/tenant-assets/${sanitizedSlug}`,
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

  // Migrate legacy /assets/tenants/<slug>/... URLs to the new route
  // handler. Next.js' production static handler only serves files that
  // existed at build time, so any path under /assets/tenants/ that was
  // written after `next build` will 404. The /api/tenant-assets/[slug]/[file]
  // route reads from disk at request time, so it always works.
  const legacyBase = `/assets/tenants/${previousSlug}/`;
  if (assetPath.startsWith(legacyBase)) {
    return assetPath.replace(legacyBase, `/api/tenant-assets/${nextSlug}/`);
  }

  const previousBase = `/api/tenant-assets/${previousSlug}/`;
  if (!assetPath.startsWith(previousBase)) {
    return assetPath;
  }

  return assetPath.replace(previousBase, `/api/tenant-assets/${nextSlug}/`);
}

/**
 * One-shot URL migrator that converts any stored branding URL of the
 * form `/assets/tenants/<slug>/...` to the new
 * `/api/tenant-assets/<slug>/...` route. Use this on existing tenant
 * records to repair URLs that became 404-bound because of the static
 * handler limitation.
 */
export function migrateLegacyAssetPathToRoute(
  assetPath: string | undefined,
  slug: string,
): string | undefined {
  if (!assetPath) {
    return assetPath;
  }
  const sanitizedSlug = assertSafeTenantSlug(slug);
  const legacyBase = `/assets/tenants/${sanitizedSlug}/`;
  if (assetPath.startsWith(legacyBase)) {
    return assetPath.replace(legacyBase, `/api/tenant-assets/${sanitizedSlug}/`);
  }
  return assetPath;
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
