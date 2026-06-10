/**
 * useTenants Hook - Manages tenant state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { CreateTenantDto, Tenant, UpdateTenantDto } from '@/types';
import { tenantService, TenantFilters } from '@/services';

interface UseTenantsResult {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  filters: TenantFilters;
  setFilters: (filters: TenantFilters) => void;
  refresh: () => Promise<void>;
  createTenant: (data: CreateTenantDto) => Promise<{ success: boolean; error?: string }>;
  updateTenant: (id: string, data: UpdateTenantDto) => Promise<{ success: boolean; error?: string }>;
  deleteTenant: (id: string, confirmation: { slug: string; acknowledgeDataLoss: boolean }) => Promise<{ success: boolean; error?: string }>;
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

  const createTenant = async (data: CreateTenantDto): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.create(data);
    if (error) {
      return { success: false, error };
    }
    await fetchTenants();
    return { success: true };
  };

  const updateTenant = async (id: string, data: UpdateTenantDto): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.update(id, data);
    if (error) {
      return { success: false, error };
    }
    await fetchTenants();
    return { success: true };
  };

  const deleteTenant = async (
    id: string,
    confirmation: { slug: string; acknowledgeDataLoss: boolean },
  ): Promise<{ success: boolean; error?: string }> => {
    const { error } = await tenantService.delete(id, confirmation);
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
