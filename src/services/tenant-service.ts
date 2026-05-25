/**
 * Tenant service wrapper backed by local Next.js API routes.
 */

import type {
  BrandingConfig,
  DashboardStats,
  RuntimeConfigOption,
  Tenant,
  TenantDashboardAccessCreateInput,
  TenantDashboardAccessSummary,
  TenantPasswordResetResult,
  TenantPublishingPreview,
  TenantPublishResult,
  TenantStatus,
  CreateTenantDto,
  UpdateTenantDto,
} from '@/types';
import type { ApiResponse } from './api-client';

const TENANT_API_BASE = '/api/super-admin/tenants';

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

      return {
        data: null,
        error: message,
      };
    }

    return {
      data: payload as T,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}

export interface TenantFilters {
  status?: TenantStatus;
  search?: string;
}

class TenantService {
  async uploadAssets(
    tenantSlug: string,
    assets: {
      logo?: File | null;
      backgroundImage?: File | null;
    },
  ): Promise<ApiResponse<{ logo: string | null; backgroundImage: string | null }>> {
    const formData = new FormData();
    formData.set('tenantSlug', tenantSlug);

    if (assets.logo) {
      formData.set('logo', assets.logo);
    }

    if (assets.backgroundImage) {
      formData.set('backgroundImage', assets.backgroundImage);
    }

    return request<{ logo: string | null; backgroundImage: string | null }>(
      `${TENANT_API_BASE}/upload-assets`,
      {
        method: 'POST',
        body: formData,
      },
    );
  }

  async checkSubdomainAvailability(subdomain: string): Promise<ApiResponse<{ available: boolean }>> {
    return request<{ available: boolean }>(`${TENANT_API_BASE}/check-subdomain`, {
      method: 'POST',
      body: JSON.stringify({ subdomain }),
    });
  }

  async getAll(filters?: TenantFilters): Promise<ApiResponse<Tenant[]>> {
    const params = new URLSearchParams();
    if (filters?.status) {
      params.set('status', filters.status);
    }
    if (filters?.search) {
      params.set('search', filters.search);
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<Tenant[]>(`${TENANT_API_BASE}${suffix}`);
  }

  async getById(id: string): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(`${TENANT_API_BASE}/${id}`);
  }

  async create(data: CreateTenantDto): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(TENANT_API_BASE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id: string, data: UpdateTenantDto): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(`${TENANT_API_BASE}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateBranding(
    id: string,
    branding: Partial<BrandingConfig>,
  ): Promise<ApiResponse<Tenant>> {
    return this.update(id, { branding });
  }

  async delete(
    id: string,
    confirmationText?: string,
  ): Promise<ApiResponse<void>> {
    return request<void>(`${TENANT_API_BASE}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({
        confirmationText,
      }),
    });
  }

  async getRuntimeConfigOptions(
    tenantId: string,
  ): Promise<ApiResponse<RuntimeConfigOption[]>> {
    return request<RuntimeConfigOption[]>(
      `${TENANT_API_BASE}/${tenantId}/runtime-configs`,
    );
  }

  async getPublishingPreview(
    tenantId: string,
  ): Promise<ApiResponse<TenantPublishingPreview>> {
    return request<TenantPublishingPreview>(
      `${TENANT_API_BASE}/${tenantId}/publishing-preview`,
    );
  }

  async publishRuntime(
    tenantId: string,
    activate = true,
  ): Promise<ApiResponse<TenantPublishResult>> {
    return request<TenantPublishResult>(`${TENANT_API_BASE}/${tenantId}/publish`, {
      method: 'POST',
      body: JSON.stringify({ activate }),
    });
  }

  async activateRuntimeConfig(
    tenantId: string,
    runtimeConfigId: string,
  ): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(`${TENANT_API_BASE}/${tenantId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ runtimeConfigId }),
    });
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return request<DashboardStats>(`${TENANT_API_BASE}/stats`);
  }

  async getActiveCount(): Promise<number> {
    const { data } = await this.getAll({ status: 'active' });
    return data?.length ?? 0;
  }

  async getBrandingByTenantId(tenantId: string): Promise<BrandingConfig> {
    const { data } = await this.getById(tenantId);
    return data?.branding ?? {};
  }

  async archive(tenantId: string): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(`${TENANT_API_BASE}/${tenantId}/archive`, {
      method: 'POST',
    });
  }

  async restore(tenantId: string, newSubdomain?: string): Promise<ApiResponse<Tenant>> {
    return request<Tenant>(`${TENANT_API_BASE}/${tenantId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ newSubdomain }),
    });
  }

  async getTenantsByTemplate(templateId: string): Promise<ApiResponse<{ id: string; name: string; subdomain: string; status: string }[]>> {
    return request<{ id: string; name: string; subdomain: string; status: string }[]>(
      `${TENANT_API_BASE}/by-template?templateId=${encodeURIComponent(templateId)}`
    );
  }

  async getDashboardAccess(
    tenantId: string,
  ): Promise<ApiResponse<TenantDashboardAccessSummary>> {
    return request<TenantDashboardAccessSummary>(
      `${TENANT_API_BASE}/${tenantId}/dashboard-access`,
    );
  }

  async createDashboardAccess(
    tenantId: string,
    data: TenantDashboardAccessCreateInput,
  ): Promise<ApiResponse<TenantDashboardAccessSummary>> {
    return request<TenantDashboardAccessSummary>(
      `${TENANT_API_BASE}/${tenantId}/dashboard-access`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  }

  async disableDashboardAccess(
    tenantId: string,
  ): Promise<ApiResponse<TenantDashboardAccessSummary>> {
    return request<TenantDashboardAccessSummary>(
      `${TENANT_API_BASE}/${tenantId}/dashboard-access`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'disable' }),
      },
    );
  }

  async reactivateDashboardAccess(
    tenantId: string,
  ): Promise<ApiResponse<TenantDashboardAccessSummary>> {
    return request<TenantDashboardAccessSummary>(
      `${TENANT_API_BASE}/${tenantId}/dashboard-access`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reactivate' }),
      },
    );
  }

  async resetDashboardPassword(
    tenantId: string,
  ): Promise<ApiResponse<TenantPasswordResetResult>> {
    return request<TenantPasswordResetResult>(
      `${TENANT_API_BASE}/${tenantId}/dashboard-access/reset-password`,
      {
        method: 'POST',
      },
    );
  }
}

export const tenantService = new TenantService();
