/**
 * Tenant service wrapper for shared hooks and pages.
 */

import type {
  BrandingConfig,
  CreateTenantDto,
  DashboardStats,
  Tenant,
  TenantStatus,
  UpdateTenantDto,
} from '@/types';
import { apiClient, type ApiResponse } from './api-client';
import {
  createTenant as createTenantRecord,
  deleteTenant as deleteTenantRecord,
  getAllTenants,
  getTenantById,
  getTenantStats,
  updateTenant as updateTenantRecord,
  updateTenantBranding as updateTenantBrandingRecord,
} from '@/modules/tenant/service';

const USE_MOCK_DATA = true;

export interface TenantFilters {
  status?: TenantStatus;
  search?: string;
}

class TenantService {
  async getAll(filters?: TenantFilters): Promise<ApiResponse<Tenant[]>> {
    if (USE_MOCK_DATA) {
      let tenants = await getAllTenants();

      if (filters?.status) {
        tenants = tenants.filter((tenant) => tenant.status === filters.status);
      }

      if (filters?.search) {
        const search = filters.search.toLowerCase();
        tenants = tenants.filter((tenant) => {
          const runtimeConfigId = tenant.activeRuntimeConfigId ?? '';
          return (
            tenant.name.toLowerCase().includes(search) ||
            tenant.slug.toLowerCase().includes(search) ||
            runtimeConfigId.toLowerCase().includes(search)
          );
        });
      }

      return { data: tenants, error: null };
    }

    return apiClient.get<Tenant[]>('/api/super-admin/tenants');
  }

  async getById(id: string): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      const tenant = await getTenantById(id);
      if (!tenant) {
        return { data: null, error: 'Tenant not found' };
      }

      return { data: tenant, error: null };
    }

    return apiClient.get<Tenant>(`/api/super-admin/tenants/${id}`);
  }

  async create(
    data: CreateTenantDto,
  ): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      try {
        const tenant = await createTenantRecord(data);
        return { data: tenant, error: null };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : 'Failed to create tenant',
        };
      }
    }

    return apiClient.post<Tenant>('/api/super-admin/tenants', data);
  }

  async update(
    id: string,
    data: UpdateTenantDto,
  ): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      try {
        const tenant = await updateTenantRecord(id, data);
        return { data: tenant, error: null };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : 'Failed to update tenant',
        };
      }
    }

    return apiClient.put<Tenant>(`/api/super-admin/tenants/${id}`, data);
  }

  async updateBranding(
    id: string,
    branding: Partial<BrandingConfig>,
  ): Promise<ApiResponse<Tenant>> {
    if (USE_MOCK_DATA) {
      try {
        const tenant = await updateTenantBrandingRecord(id, branding);
        return { data: tenant, error: null };
      } catch (error) {
        return {
          data: null,
          error: error instanceof Error ? error.message : 'Failed to update branding',
        };
      }
    }

    return apiClient.put<Tenant>(`/api/super-admin/tenants/${id}/branding`, branding);
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_DATA) {
      try {
        await deleteTenantRecord(id);
        return { data: undefined, error: null };
      } catch (error) {
        return {
          data: undefined,
          error: error instanceof Error ? error.message : 'Failed to delete tenant',
        };
      }
    }

    return apiClient.delete<void>(`/api/super-admin/tenants/${id}`);
  }

  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    if (USE_MOCK_DATA) {
      const stats = await getTenantStats();

      return {
        data: {
          totalTenants: stats.total,
          activeTenants: stats.active,
          draftTenants: stats.draft,
          disabledTenants: stats.disabled,
          archivedTenants: stats.archived,
          activeRuntimeConfigs: stats.activeRuntimeConfigs,
          activeScanners: 4,
          totalLogs: 156,
          totalSubmissions: 5478,
          avgScore: 4.2,
          tenantsByBranding: {
            custom: stats.byBranding.custom,
            default: stats.byBranding.default,
            withWarnings: stats.byBranding.warnings,
          },
          recentActivity: [
            { date: '2026-05-04', submissions: 132, newTenants: 1 },
            { date: '2026-05-05', submissions: 145, newTenants: 0 },
            { date: '2026-05-06', submissions: 167, newTenants: 1 },
            { date: '2026-05-07', submissions: 158, newTenants: 0 },
            { date: '2026-05-08', submissions: 182, newTenants: 0 },
            { date: '2026-05-09', submissions: 176, newTenants: 1 },
            { date: '2026-05-10', submissions: 191, newTenants: 0 },
          ],
        },
        error: null,
      };
    }

    return apiClient.get<DashboardStats>('/api/super-admin/dashboard');
  }

  async getActiveCount(): Promise<number> {
    const { data } = await this.getAll({ status: 'active' });
    return data?.length ?? 0;
  }

  async getBrandingByTenantId(tenantId: string): Promise<BrandingConfig> {
    const { data } = await this.getById(tenantId);
    return data?.branding ?? {};
  }
}

export const tenantService = new TenantService();
