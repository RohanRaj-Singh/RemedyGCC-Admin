/**
 * useTenants Hook - Manages tenant state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { Tenant } from '@/types';
import { tenantService, TenantFilters } from '@/services';

interface UseTenantsResult {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  filters: TenantFilters;
  setFilters: (filters: TenantFilters) => void;
  refresh: () => Promise<void>;
  createTenant: (data: Omit<Tenant, 'id'>) => Promise<{ success: boolean; error?: string }>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<{ success: boolean; error?: string }>;
  deleteTenant: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function useTenants(): UseTenantsResult {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TenantFilters>({});

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await tenantService.getAll(filters);
    
    if (fetchError) {
      setError(fetchError);
    } else {
      setTenants(data || []);
    }
    
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const createTenant = async (data: Omit<Tenant, 'id'>): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.create(data);
    if (error) {
      return { success: false, error };
    }
    await fetchTenants();
    return { success: true };
  };

  const updateTenant = async (id: string, data: Partial<Tenant>): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.update(id, data);
    if (error) {
      return { success: false, error };
    }
    await fetchTenants();
    return { success: true };
  };

  const deleteTenant = async (id: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.delete(id);
    if (error) {
      return { success: false, error };
    }
    await fetchTenants();
    return { success: true };
  };

  return {
    tenants,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchTenants,
    createTenant,
    updateTenant,
    deleteTenant,
  };
}
