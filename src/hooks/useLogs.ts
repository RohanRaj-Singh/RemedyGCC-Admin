/**
 * useLogs Hook - Manages system log state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { SystemLog } from '@/types';
import { logService, LogFilters } from '@/services';

interface UseLogsResult {
  logs: SystemLog[];
  loading: boolean;
  error: string | null;
  filters: LogFilters;
  setFilters: (filters: LogFilters) => void;
  refresh: () => Promise<void>;
}

export function useLogs(): UseLogsResult {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await logService.getAll(filters);
    
    if (fetchError) {
      setError(fetchError);
    } else {
      setLogs(data || []);
    }
    
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    filters,
    setFilters,
    refresh: fetchLogs,
  };
}
