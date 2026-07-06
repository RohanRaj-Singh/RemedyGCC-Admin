import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/app/api/_utils/auth-guard';
import { apiErrorResponse } from '@/app/api/super-admin/tenants/_utils';
import {
  ensureClinicAssetDirectory,
  saveClinicCoverImage,
  saveClinicGalleryImage,
  saveClinicLogo,
} from '@/lib/uploads/clinic-assets';
import { getClinicDocumentById, getClinicDocumentBySlug, updateClinicDocument } from '@/server/clinic/repository';
import { normalizeClinicSlugInput, validateClinicSlug } from '@/modules/clinic/utils';

export const runtime = 'nodejs';

function getOptionalFile(value: FormDataEntryValue | null): File | null {
  if (!value || typeof value === 'string') return null;
  return value.size > 0 ? value : null;
}

async function resolveClinicForUpload(formData: FormData): Promise<{ clinicId: string | null; clinicSlug: string }> {
  const rawClinicId = formData.get('clinicId');
  if (typeof rawClinicId === 'string' && rawClinicId.trim()) {
    const clinic = await getClinicDocumentById(rawClinicId.trim());
    if (!clinic) throw new Error('Clinic not found for the provided id.');
    return { clinicId: clinic.id, clinicSlug: clinic.slug };
  }

  const rawSlug = formData.get('clinicSlug');
  if (typeof rawSlug !== 'string' || !rawSlug.trim()) {
    throw new Error('Clinic id or slug is required.');
  }

  const clinic = await getClinicDocumentBySlug(rawSlug.trim());
  if (clinic) return { clinicId: clinic.id, clinicSlug: clinic.slug };

  const pendingFlag = formData.get('pending');
  if (pendingFlag === '1' || pendingFlag === 'true') {
    const normalized = normalizeClinicSlugInput(rawSlug);
    const validation = validateClinicSlug(normalized);
    if (validation.errors.length > 0) throw new Error(validation.errors[0]);
    return { clinicId: null, clinicSlug: validation.normalized };
  }

  throw new Error('Clinic not found for the provided slug.');
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request);
  if (!auth.success) return auth.response!;

  try {
    const formData = await request.formData();
    const { clinicId, clinicSlug } = await resolveClinicForUpload(formData);

    const logoFile = getOptionalFile(formData.get('logo'));
    const coverFile = getOptionalFile(formData.get('coverImage'));
    const galleryFile = getOptionalFile(formData.get('gallery'));
    const assetType = formData.get('assetType'); // 'logo' | 'coverImage' | 'gallery'

    if (!logoFile && !coverFile && !galleryFile) {
      throw new Error('Upload at least one asset.');
    }

    await ensureClinicAssetDirectory(clinicSlug);

    const [logo, coverImage, galleryImage] = await Promise.all([
      logoFile ? saveClinicLogo(clinicSlug, logoFile) : Promise.resolve(null),
      coverFile ? saveClinicCoverImage(clinicSlug, coverFile) : Promise.resolve(null),
      galleryFile ? saveClinicGalleryImage(clinicSlug, galleryFile) : Promise.resolve(null),
    ]);

    // Atomic persistence: immediately update the clinic document so the
    // uploaded asset is referenced even if the admin never clicks Save Changes.
    if (clinicId) {
      const now = new Date().toISOString();
      const dbUpdates: Record<string, unknown> = { updatedAt: now };
      if (logo) dbUpdates.logo = logo;
      if (coverImage) dbUpdates.coverImage = coverImage;
      if (galleryImage) {
        const current = await getClinicDocumentById(clinicId);
        const existing = current?.gallery ?? [];
        dbUpdates.gallery = [...existing, galleryImage];
      }
      await updateClinicDocument(clinicId, dbUpdates);
    }

    return NextResponse.json({
      clinicSlug,
      logo,
      coverImage,
      galleryImage,
      assetType: assetType || 'logo',
    });
  } catch (error) {
    return apiErrorResponse(error, 400);
  }
}
