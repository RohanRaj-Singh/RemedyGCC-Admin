/**
 * Log Service - Business logic for system log operations
 */

import { SystemLog } from '@/types';
import { apiClient, ApiResponse } from './api-client';
import { systemLogs as mockLogs } from '@/data/mockData';

const USE_MOCK_DATA = true;

export interface LogFilters {
  level?: 'info' | 'warning' | 'error';
  module?: 'tenant' | 'scanner' | 'submission' | 'system';
  tenantId?: string;
}

class LogService {
  /**
   * Get all logs with optional filtering
   */
  async getAll(filters?: LogFilters): Promise<ApiResponse<SystemLog[]>> {
    if (USE_MOCK_DATA) {
      let filtered = [...mockLogs];
      
      if (filters?.level) {
        filtered = filtered.filter(l => l.level === filters.level);
      }
      if (filters?.module) {
        filtered = filtered.filter(l => l.module === filters.module);
      }
      if (filters?.tenantId) {
        filtered = filtered.filter(l => l.tenantId === filters.tenantId);
      }
      
      // Sort by timestamp descending (newest first)
      filtered.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      return { data: filtered, error: null };
    }

    const params = new URLSearchParams();
    if (filters?.level) params.append('level', filters.level);
    if (filters?.module) params.append('module', filters.module);
    if (filters?.tenantId) params.append('tenantId', filters.tenantId);
    
    const query = params.toString();
    const endpoint = query 
      ? `/api/super-admin/logs?${query}` 
      : '/api/super-admin/logs';
    
    return apiClient.get<SystemLog[]>(endpoint);
  }

  /**
   * Get error logs only
   */
  async getErrors(): Promise<ApiResponse<SystemLog[]>> {
    return this.getAll({ level: 'error' });
  }

  /**
   * Get warning logs only
   */
  async getWarnings(): Promise<ApiResponse<SystemLog[]>> {
    return this.getAll({ level: 'warning' });
  }

  /**
   * Get logs by tenant
   */
  async getByTenant(tenantId: string): Promise<ApiResponse<SystemLog[]>> {
    return this.getAll({ tenantId });
  }

  /**
   * Get recent logs (last N)
   */
  async getRecent(count: number = 10): Promise<ApiResponse<SystemLog[]>> {
    const { data, error } = await this.getAll();
    if (error || !data) {
      return { data: null, error };
    }
    return { data: data.slice(0, count), error: null };
  }
}

export const logService = new LogService();
