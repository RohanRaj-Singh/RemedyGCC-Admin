'use client';

import { useMemo } from 'react';
import { BrandingConfig, Tenant } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';

export function useTenantBranding(tenant: Tenant | null | undefined): {
  branding: BrandingConfig;
  isCustom: boolean;
  primaryColor: string;
  cssVariables: React.CSSProperties;
} {
  const branding = tenant?.branding || DEFAULT_BRANDING;

  const isCustom = useMemo(() => {
    return JSON.stringify(branding) !== JSON.stringify(DEFAULT_BRANDING);
  }, [branding]);

  const primaryColor = branding.colorScheme.primaryColor;

  const cssVariables = useMemo(() => ({
    '--brand-primary': branding.colorScheme.primaryColor,
    '--brand-secondary': branding.colorScheme.secondaryColor || branding.colorScheme.primaryColor,
    '--brand-background': branding.colorScheme.backgroundColor || '0 0% 100%',
    '--brand-text': branding.colorScheme.textColor || '0 0% 43%',
    '--brand-accent': branding.colorScheme.accentColor || '212 100% 50%',
    '--brand-font': branding.fontFamily || 'Satoshi, Inter, sans-serif',
    '--brand-logo': branding.logoUrl || '/default-logo.svg',
  } as React.CSSProperties), [branding]);

  return {
    branding,
    isCustom,
    primaryColor,
    cssVariables,
  };
}

export function getBrandingCSSVariables(branding: BrandingConfig): React.CSSProperties {
  return {
    '--brand-primary': branding.colorScheme.primaryColor,
    '--brand-secondary': branding.colorScheme.secondaryColor || branding.colorScheme.primaryColor,
    '--brand-background': branding.colorScheme.backgroundColor || '0 0% 100%',
    '--brand-text': branding.colorScheme.textColor || '0 0% 43%',
    '--brand-accent': branding.colorScheme.accentColor || '212 100% 50%',
    '--brand-font': branding.fontFamily || 'Satoshi, Inter, sans-serif',
    '--brand-logo': branding.logoUrl || '/default-logo.svg',
  } as React.CSSProperties;
}