import type { NextApiRequest, NextApiResponse } from 'next';
import { validateSession } from '@/modules/auth/service';
import { SESSION_COOKIE_NAME } from '@/modules/auth/utils';
import {
  ensureTenantAssetDirectory,
  saveTenantBackground,
  saveTenantLogo,
} from '@/lib/uploads/tenant-assets';
import { getTenantDocumentById } from '@/server/tenant/repository';
import { getTenantBySlug } from '@/modules/tenant/service';
import { normalizeTenantSlugInput, validateTenantSlug } from '@/modules/tenant/utils';
import busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '10mb',
  },
};

interface UploadResult {
  tenantSlug: string;
  logo: string | null;
  backgroundImage: string | null;
}

async function requireApiAuthPages(req: NextApiRequest) {
  const sessionToken = req.cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return { success: false as const, message: 'Authentication required.' };
  }

  const sessionInfo = await validateSession(sessionToken);
  if (!sessionInfo) {
    return { success: false as const, message: 'Session expired. Please log in again.' };
  }

  return { success: true as const };
}

async function resolveTenantForUpload(
  fields: Record<string, string>,
): Promise<{ tenantId: string | null; tenantSlug: string }> {
  const rawTenantId = fields.tenantId;
  if (rawTenantId?.trim()) {
    const tenant = await getTenantDocumentById(rawTenantId.trim());
    if (!tenant) {
      throw new Error('Tenant not found for the provided tenantId.');
    }
    return { tenantId: tenant.tenantId, tenantSlug: tenant.slug };
  }

  const rawTenantSlug = fields.tenantSlug;
  if (!rawTenantSlug?.trim()) {
    throw new Error('Tenant id or slug is required.');
  }

  const tenant = await getTenantBySlug(rawTenantSlug.trim());
  if (tenant) {
    return { tenantId: tenant.id, tenantSlug: tenant.slug };
  }

  const pendingFlag = fields.pending;
  if (pendingFlag === '1' || pendingFlag === 'true') {
    const normalized = normalizeTenantSlugInput(rawTenantSlug);
    const validation = validateTenantSlug(normalized);
    if (validation.errors.length > 0) {
      throw new Error(validation.errors[0]);
    }
    return { tenantId: null, tenantSlug: validation.normalized };
  }

  throw new Error('Tenant not found for the provided slug.');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const auth = await requireApiAuthPages(req);
  if (!auth.success) {
    return res.status(401).json({ error: { message: auth.message } });
  }

  try {
    const { fields, logoFile, backgroundFile } = await parseMultipart(req);

    const { tenantSlug } = await resolveTenantForUpload(fields);
    await ensureTenantAssetDirectory(tenantSlug);

    const [logo, backgroundImage] = await Promise.all([
      logoFile
        ? saveTenantLogo(tenantSlug, new File([new Uint8Array(logoFile.buffer)], logoFile.name, { type: logoFile.mimeType }))
        : Promise.resolve(null),
      backgroundFile
        ? saveTenantBackground(tenantSlug, new File([new Uint8Array(backgroundFile.buffer)], backgroundFile.name, { type: backgroundFile.mimeType }))
        : Promise.resolve(null),
    ]);

    return res.status(200).json({ tenantSlug, logo, backgroundImage });
  } catch (error) {
    const statusCode = error instanceof Error && error.message.includes('exceeds') ? 413 : 400;
    return res.status(statusCode).json({
      error: { message: error instanceof Error ? error.message : 'Unexpected upload error.' },
    });
  }
}

function parseMultipart(
  req: NextApiRequest,
): Promise<{
  fields: Record<string, string>;
  logoFile: { buffer: Buffer; name: string; mimeType: string } | null;
  backgroundFile: { buffer: Buffer; name: string; mimeType: string } | null;
}> {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: req.headers as Record<string, string>,
      limits: { fileSize: 5 * 1024 * 1024 },
    });

    const fields: Record<string, string> = {};
    let logoFile: { buffer: Buffer; name: string; mimeType: string } | null = null;
    let backgroundFile: { buffer: Buffer; name: string; mimeType: string } | null = null;
    let hasFile = false;

    bb.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      if (!info.filename) return;
      hasFile = true;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const fileData = {
          buffer: Buffer.concat(chunks),
          name: info.filename,
          mimeType: info.mimeType,
        };
        if (name === 'logo') {
          logoFile = fileData;
        } else if (name === 'background' || name === 'backgroundImage') {
          backgroundFile = fileData;
        }
      });
    });

    bb.on('finish', () => {
      if (!hasFile) {
        return reject(new Error('Upload at least one asset.'));
      }
      resolve({ fields, logoFile, backgroundFile });
    });

    bb.on('error', (err) => reject(err));

    req.pipe(bb);
  });
}
