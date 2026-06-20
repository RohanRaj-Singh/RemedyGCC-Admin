/**
 * Clinic service wrapper backed by admin API routes.
 */

import type { ApiResponse } from './api-client';
import type { Clinic, ClinicStatus, CreateClinicDto, DeleteClinicConsequences, UpdateClinicDto } from '@/modules/clinic/types';

const CLINIC_API_BASE = '/api/super-admin/clinics';

async function request<T>(
  input: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const isFormDataBody =
      typeof FormData !== 'undefined' && init.body instanceof FormData;
    const response = await fetch(input, {
      ...init,
      headers: {
        ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => null) as
      | T
      | { error?: { message?: string } | string }
      | null;

    if (!response.ok) {
      const errorPayload = payload as { error?: { message?: string } | string } | null;
      const message =
        typeof errorPayload?.error === 'string'
          ? errorPayload.error
          : errorPayload?.error?.message
            || `Request failed with ${response.status}.`;

      return { data: null, error: message };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}

export interface ClinicFilters {
  status?: ClinicStatus;
  search?: string;
}

class ClinicService {
  async getAll(filters?: ClinicFilters): Promise<ApiResponse<Clinic[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.search) params.set('search', filters.search);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<Clinic[]>(`${CLINIC_API_BASE}${suffix}`);
  }

  async getById(id: string): Promise<ApiResponse<Clinic>> {
    return request<Clinic>(`${CLINIC_API_BASE}/${id}`);
  }

  async create(data: CreateClinicDto): Promise<ApiResponse<Clinic>> {
    return request<Clinic>(CLINIC_API_BASE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id: string, data: UpdateClinicDto): Promise<ApiResponse<Clinic>> {
    return request<Clinic>(`${CLINIC_API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async checkSlugAvailability(slug: string): Promise<ApiResponse<{ available: boolean }>> {
    return request<{ available: boolean }>(`${CLINIC_API_BASE}/check-slug`, {
      method: 'POST',
      body: JSON.stringify({ slug }),
    });
  }

  async uploadAssets(
    clinicIdentifier: { clinicId: string; clinicSlug: string },
    assets: { logo?: File | null; coverImage?: File | null; gallery?: File | null },
  ): Promise<ApiResponse<{ clinicSlug: string; logo: string | null; coverImage: string | null; galleryImage: string | null; assetType: string }>> {
    const formData = new FormData();
    formData.set('clinicId', clinicIdentifier.clinicId);
    formData.set('clinicSlug', clinicIdentifier.clinicSlug);
    formData.set('assetType', assets.gallery ? 'gallery' : assets.logo ? 'logo' : 'coverImage');
    if (assets.logo) formData.set('logo', assets.logo);
    if (assets.coverImage) formData.set('coverImage', assets.coverImage);
    if (assets.gallery) formData.set('gallery', assets.gallery);

    return request<{ clinicSlug: string; logo: string | null; coverImage: string | null; galleryImage: string | null; assetType: string }>(
      `${CLINIC_API_BASE}/upload-assets`,
      { method: 'POST', body: formData },
    );
  }

  async previewDelete(id: string): Promise<ApiResponse<DeleteClinicConsequences>> {
    return request<DeleteClinicConsequences>(`${CLINIC_API_BASE}/${id}`, {
      method: 'DELETE',
      body: null,
    });
  }

  async delete(id: string, confirmation: { slug: string }): Promise<ApiResponse<void>> {
    return request<void>(`${CLINIC_API_BASE}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(confirmation),
    });
  }
}

export const clinicService = new ClinicService();
