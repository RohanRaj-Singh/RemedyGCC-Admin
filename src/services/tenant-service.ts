/**
 * Tenant Service - Business logic for tenant operations
 * Separates data fetching from business logic
 */

import { Tenant, DashboardStats, BrandingConfig } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';
import { apiClient, ApiResponse } from './api-client';
import { dashboardStats, tenants as mockTenants } from '@/data/mockData';

const USE_MOCK_DATA = true;

export interface TenantFilters {
  status?: 'active' | 'inactive' | 'suspended';
  search?: string;
}

export interface UpdateBrandingParams {
  logoUrl?: string;
  faviconUrl?: string;
  colorScheme?: Partial<BrandingConfig['colorScheme']>;
  fontFamily?: string;
}

class TenantService {
  async getAll(filters?: TenantFilters): Promise<ApiResponse<Tenant[]>> {
    if (USE_MOCK_DATA) {
      let filtered = [...mockTenants];
      
      if (filters?.status) {
        filtered = filtered.filter(t => t.status === filters.status);
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(t => 
          t.name.toLowerCase().includes(search) ||
          t.domain.toLowerCase().includes(search) ||
          t.slug.toLowerCase().includes(search)
        );
      }
      
      return { data: filtered, error: null };
    }

    return apiClient.get<Tenant[]>('/api/super-admin/tenants');
  }

  async getById(id: string): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      const tenant = mockTenants.find(t => t.id === id);
      if (!tenant) {
        return { data: null, error: 'Tenant not found' };
      }
      return { data: tenant, error: null };
    }

    return apiClient.get<Tenant>(`/api/super-admin/tenants/${id}`);
  }

  async create(data: Omit<Tenant, 'id'>): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      const newTenant: Tenant = {
        ...data,
        branding: data.branding ?? DEFAULT_BRANDING,
        id: `tenant-${Date.now()}`,
      };
      return { data: newTenant, error: null };
    }

    return apiClient.post<Tenant>('/api/super-admin/tenants', data);
  }

  async update(id: string, data: Partial<Tenant>): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      const tenant = mockTenants.find(t => t.id === id);
      if (!tenant) {
        return { data: null, error: 'Tenant not found' };
      }
      return { data: { ...tenant, ...data }, error: null };
    }

    return apiClient.put<Tenant>(`/api/super-admin/tenants/${id}`, data);
  }

  async updateBranding(id: string, branding: Partial<BrandingConfig>): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      const tenant = mockTenants.find(t => t.id === id);
      if (!tenant) {
        return { data: null, error: 'Tenant not found' };
      }
      const updatedTenant: Tenant = {
        ...tenant,
        branding: { ...DEFAULT_BRANDING, ...tenant.branding, ...branding },
      };
      return { data: updatedTenant, error: null };
    }

    return apiClient.put<Tenant>(`/api/super-admin/tenants/${id}/branding`, branding);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_DATA) {
      return { data: undefined, error: null };
    }

    return apiClient.delete<void>(`/api/super-admin/tenants/${id}`);
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    if (USE_MOCK_DATA) {
      return { data: dashboardStats, error: null };
    }

    return apiClient.get<DashboardStats>('/api/super-admin/dashboard');
  }

  async getActiveCount(): Promise<number> {
    const { data } = await this.getAll({ status: 'active' });
    return data?.length ?? 0;
  }

  async getBrandingByTenantId(tenantId: string): Promise<BrandingConfig> {
    const { data } = await this.getById(tenantId);
    if (!data) {
      return DEFAULT_BRANDING;
    }
    return data.branding ?? DEFAULT_BRANDING;
  }
}

export const tenantService = new TenantService();