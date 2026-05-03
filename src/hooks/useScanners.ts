/**
 * useScanners Hook - Manages scanner state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { Scanner } from '@/modules/scanner/types';
import { getScanners } from '@/modules/scanner/service';

interface UseScannersResult {
  scanners: Scanner[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useScanners(): UseScannersResult {
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getScanners();
      setScanners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch scanners');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScanners();
  }, [fetchScanners]);

  return {
    scanners,
    loading,
    error,
    refresh: fetchScanners,
  };
}
