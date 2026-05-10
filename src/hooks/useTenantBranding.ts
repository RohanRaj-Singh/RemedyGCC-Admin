'use client';

import { useMemo } from 'react';
import { BrandingConfig, Tenant } from '@/types';
import {
  brandingToCSSVars,
  isDefaultBranding,
  resolveBrandingConfig,
} from '@/types/branding';

export function useTenantBranding(tenant: Tenant | null | undefined): {
  branding: BrandingConfig;
  isCustom: boolean;
  primaryColor: string;
  cssVariables: React.CSSProperties;
} {
  const branding = tenant?.branding || {};
  const resolved = resolveBrandingConfig(branding);

  const isCustom = useMemo(() => {
    return !isDefaultBranding(branding);
  }, [branding]);

  const primaryColor = resolved.primaryColor;

  const cssVariables = useMemo(
    () =>
      ({
        ...brandingToCSSVars(resolved),
        '--brand-background': '#ffffff',
        '--brand-text': '#111827',
        '--brand-accent': resolved.secondaryColor,
      } as React.CSSProperties),
    [resolved],
  );

  return {
    branding: resolved,
    isCustom,
    primaryColor,
    cssVariables,
  };
}

export function getBrandingCSSVariables(branding: BrandingConfig): React.CSSProperties {
  const resolved = resolveBrandingConfig(branding);
  return {
    ...brandingToCSSVars(resolved),
    '--brand-background': '#ffffff',
    '--brand-text': '#111827',
    '--brand-accent': resolved.secondaryColor,
  } as React.CSSProperties;
}
