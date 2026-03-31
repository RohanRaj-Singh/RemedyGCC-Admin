/**
 * useScanners Hook - Manages scanner state and data fetching
 */

import { useState, useEffect, useCallback } from 'react';
import { Scanner } from '@/modules/scanner/types';
import { getScanners, createScanner as createScannerApi, updateScanner as updateScannerApi, deleteScanner as deleteScannerApi } from '@/modules/scanner/service';

interface UseScannersResult {
  scanners: Scanner[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createScanner: (data: { name: string; description?: string; templateId: string; questions: { text: string; options: string[]; weight: number }[] }) => Promise<{ success: boolean; error?: string }>;
  updateScanner: (id: string, data: Partial<Scanner>) => Promise<{ success: boolean; error?: string }>;
  deleteScanner: (id: string) => Promise<{ success: boolean; error?: string }>;
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

  const createScanner = async (data: { name: string; description?: string; templateId: string; questions: { text: string; options: string[]; weight: number }[] }): Promise<{ success: boolean; error?: string }> => {
    try {
      await createScannerApi(data);
      await fetchScanners();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create scanner' };
    }
  };

  const updateScanner = async (id: string, data: Partial<Scanner>): Promise<{ success: boolean; error?: string }> => {
    try {
      await updateScannerApi(id, data);
      await fetchScanners();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update scanner' };
    }
  };

  const deleteScanner = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await deleteScannerApi(id);
      await fetchScanners();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete scanner' };
    }
  };

  return {
    scanners,
    loading,
    error,
    refresh: fetchScanners,
    createScanner,
    updateScanner,
    deleteScanner,
  };
}
