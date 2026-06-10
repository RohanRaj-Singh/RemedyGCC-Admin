import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '../_utils';
import {
  ensureTenantAssetDirectory,
  saveTenantBackground,
  saveTenantLogo,
} from '@/lib/uploads/tenant-assets';
import { getTenantDocumentById } from '@/server/tenant/repository';
import { getTenantBySlug } from '@/modules/tenant/service';
import { normalizeTenantSlugInput, validateTenantSlug } from '@/modules/tenant/utils';

export const runtime = 'nodejs';

function getOptionalFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === 'string') {
    return null;
  }

  return value.size > 0 ? value : null;
}

/**
 * Resolve the server-side tenant for an upload.
 *
 * Prefers `tenantId` from the form body (authoritative). Falls back to
 * `tenantSlug`, but in that case we still re-resolve the tenant so the
 * asset is written to the *tenant's real slug* directory — not whatever
 * slug the client guessed. This prevents cross-tenant asset path leaks
 * when the form's subdomain field has been edited or got out of sync.
 *
 * If `pending=1` is sent, the tenant doesn't exist yet (e.g. the new
 * tenant page) and we accept the sanitized slug as the upload target.
 */
async function resolveTenantForUpload(
  formData: FormData,
): Promise<{ tenantId: string | null; tenantSlug: string }> {
  const rawTenantId = formData.get('tenantId');
  if (typeof rawTenantId === 'string' && rawTenantId.trim()) {
    const tenant = await getTenantDocumentById(rawTenantId.trim());
    if (!tenant) {
      throw new Error('Tenant not found for the provided tenantId.');
    }
    return { tenantId: tenant.tenantId, tenantSlug: tenant.slug };
  }

  const rawTenantSlug = formData.get('tenantSlug');
  if (typeof rawTenantSlug !== 'string' || !rawTenantSlug.trim()) {
    throw new Error('Tenant id or slug is required.');
  }

  const tenant = await getTenantBySlug(rawTenantSlug.trim());
  if (tenant) {
    return { tenantId: tenant.id, tenantSlug: tenant.slug };
  }

  // Pre-creation flow: tenant doesn't exist yet, but the caller is
  // creating it. Sanitize the slug server-side and trust it for the
  // upload directory.
  const pendingFlag = formData.get('pending');
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

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const formData = await request.formData();
    const { tenantSlug } = await resolveTenantForUpload(formData);

    const logoFile = getOptionalFile(formData.get('logo'));
    const backgroundFile = getOptionalFile(
      formData.get('background') ?? formData.get('backgroundImage'),
    );

    if (!logoFile && !backgroundFile) {
      throw new Error('Upload at least one asset.');
    }

    await ensureTenantAssetDirectory(tenantSlug);

    const [logo, backgroundImage] = await Promise.all([
      logoFile ? saveTenantLogo(tenantSlug, logoFile) : Promise.resolve(null),
      backgroundFile ? saveTenantBackground(tenantSlug, backgroundFile) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      tenantSlug,
      logo,
      backgroundImage,
    });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
