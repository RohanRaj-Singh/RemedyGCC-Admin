'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BrandingConfig } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';
import { tenantService } from '@/services/tenant-service';

interface BrandingContextValue {
  branding: BrandingConfig;
  loading: boolean;
  error: string | null;
  updateBranding: (branding: Partial<BrandingConfig>) => Promise<void>;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

interface BrandingProviderProps {
  tenantId: string;
  children: ReactNode;
}

export function BrandingProvider({ tenantId, children }: BrandingProviderProps) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranding();
  }, [tenantId]);

  const loadBranding = async () => {
    try {
      setLoading(true);
      const brandingData = await tenantService.getBrandingByTenantId(tenantId);
      setBranding(brandingData);
      setError(null);
    } catch (err) {
      setError('Failed to load branding');
      console.error(err);
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  const updateBranding = async (newBranding: Partial<BrandingConfig>) => {
    try {
      setLoading(true);
      const { data } = await tenantService.updateBranding(tenantId, newBranding);
      if (data) {
        setBranding(data.branding);
      }
      setError(null);
    } catch (err) {
      setError('Failed to update branding');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, error, updateBranding, resetBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

export function useTenantBranding(tenantId: string): BrandingConfig {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const brandingData = await tenantService.getBrandingByTenantId(tenantId);
        setBranding(brandingData);
      } catch (err) {
        console.error('Failed to load branding', err);
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      fetchBranding();
    }
  }, [tenantId]);

  return branding;
}

export function applyBrandingToCSS(branding: BrandingConfig): Record<string, string> {
  return {
    '--brand-primary': branding.colorScheme.primaryColor,
    '--brand-secondary': branding.colorScheme.secondaryColor || branding.colorScheme.primaryColor,
    '--brand-background': branding.colorScheme.backgroundColor || '0 0% 100%',
    '--brand-text': branding.colorScheme.textColor || '0 0% 43%',
    '--brand-accent': branding.colorScheme.accentColor || '212 100% 50%',
  };
}