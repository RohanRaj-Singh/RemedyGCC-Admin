import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '../_utils';
import {
  ensureTenantAssetDirectory,
  saveTenantBackground,
  saveTenantLogo,
} from '@/lib/uploads/tenant-assets';
import { normalizeTenantSlugInput, validateTenantSlug } from '@/modules/tenant/utils';

export const runtime = 'nodejs';

function getOptionalFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === 'string') {
    return null;
  }

  return value.size > 0 ? value : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const formData = await request.formData();
    const rawTenantSlug = formData.get('tenantSlug');

    if (typeof rawTenantSlug !== 'string') {
      throw new Error('Tenant slug is required.');
    }

    const tenantSlug = normalizeTenantSlugInput(rawTenantSlug);
    const validation = validateTenantSlug(tenantSlug);
    if (validation.errors.length > 0) {
      throw new Error(validation.errors[0]);
    }

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
      logo,
      backgroundImage,
    });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
