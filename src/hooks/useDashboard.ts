/**
 * useDashboard Hook - Manages dashboard state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardStats } from '@/types';
import { tenantService } from '@/services';

interface UseDashboardResult {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await tenantService.getDashboardStats();
    
    if (fetchError) {
      setError(fetchError);
    } else {
      setStats(data);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
