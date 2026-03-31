/**
 * Scanner Service - Business logic for scanner operations
 */

import { Scanner } from '@/types';
import { apiClient, ApiResponse } from './api-client';
import { scanners as mockScanners } from '@/data/mockData';

const USE_MOCK_DATA = true;

export interface ScannerFilters {
  tenantId?: string;
  isActive?: boolean;
  search?: string;
}

class ScannerService {
  /**
   * Get all scanners with optional filtering
   */
  async getAll(filters?: ScannerFilters): Promise<ApiResponse<Scanner[]>> {
    if (USE_MOCK_DATA) {
      let filtered = [...mockScanners];
      
      if (filters?.tenantId) {
        filtered = filtered.filter(s => s.tenantId === filters.tenantId);
      }
      if (filters?.isActive !== undefined) {
        filtered = filtered.filter(s => s.isActive === filters.isActive);
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(s => 
          s.name.toLowerCase().includes(search) ||
          s.description.toLowerCase().includes(search)
        );
      }
      
      return { data: filtered, error: null };
    }
    return apiClient.get<Scanner[]>('/api/super-admin/scanners');
  }

  /**
   * Get scanners by tenant ID
   */
  async getByTenantId(tenantId: string): Promise<ApiResponse<Scanner[]>> {
    if (USE_MOCK_DATA) {
      const filtered = mockScanners.filter(s => s.tenantId === tenantId);
      return { data: filtered, error: null };
    }
    return apiClient.get<Scanner[]>(`/api/super-admin/scanners?tenantId=${tenantId}`);
  }

  /**
   * Get a single scanner by ID
   */
  async getById(id: string): Promise<ApiResponse<Scanner>> {
    if (USE_MOCK_DATA) {
      const scanner = mockScanners.find(s => s.id === id);
      if (!scanner) {
        return { data: null, error: 'Scanner not found' };
      }
      return { data: scanner, error: null };
    }
    return apiClient.get<Scanner>(`/api/super-admin/scanners/${id}`);
  }

  /**
   * Create a new scanner
   */
  async create(data: Omit<Scanner, 'id'>): Promise<ApiResponse<Scanner>> {
    if (USE_MOCK_DATA) {
      const newScanner: Scanner = {
        ...data,
        id: `scanner-${Date.now()}`,
      };
      return { data: newScanner, error: null };
    }
    return apiClient.post<Scanner>('/api/super-admin/scanners', data);
  }

  /**
   * Update an existing scanner
   */
  async update(id: string, data: Partial<Scanner>): Promise<ApiResponse<Scanner>> {
    if (USE_MOCK_DATA) {
      const scanner = mockScanners.find(s => s.id === id);
      if (!scanner) {
        return { data: null, error: 'Scanner not found' };
      }
      return { data: { ...scanner, ...data }, error: null };
    }
    return apiClient.put<Scanner>(`/api/super-admin/scanners/${id}`, data);
  }

  /**
   * Delete a scanner
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    if (USE_MOCK_DATA) {
      return { data: undefined, error: null };
    }
    return apiClient.delete<void>(`/api/super-admin/scanners/${id}`);
  }

  /**
   * Activate a scanner
   */
  async activate(id: string): Promise<ApiResponse<Scanner>> {
    return this.update(id, { isActive: true });
  }

  /**
   * Deactivate a scanner
   */
  async deactivate(id: string): Promise<ApiResponse<Scanner>> {
    return this.update(id, { isActive: false });
  }
}

export const scannerService = new ScannerService();
