import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  TENANT_ASSET_ROOT,
  assertSafeTenantSlug,
} from '@/lib/uploads/tenant-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

function resolveSafeAssetPath(slug: string, fileName: string): string | null {
  let sanitizedSlug: string;
  try {
    sanitizedSlug = assertSafeTenantSlug(slug);
  } catch {
    return null;
  }

  // Disallow path separators in the file name — only a flat filename is
  // allowed so a request can't escape the tenant directory.
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return null;
  }

  const resolved = path.resolve(TENANT_ASSET_ROOT, sanitizedSlug, fileName);
  if (!resolved.startsWith(TENANT_ASSET_ROOT)) {
    return null;
  }
  return resolved;
}

export async function GET(
  _request: NextRequest,
  context: { params: { slug: string; file: string } },
) {
  const { slug, file } = context.params;
  const resolvedPath = resolveSafeAssetPath(slug, file);

  if (!resolvedPath) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const buffer = await fs.readFile(resolvedPath);
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'Last-Modified': stat.mtime.toUTCString(),
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
