'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { BrandingConfig } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';
import { Tenant } from '@/types';

interface ThemeContextValue {
  branding: BrandingConfig;
  cssVariables: React.CSSProperties;
  isCustom: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
  tenant?: Tenant | null;
  defaultBranding?: BrandingConfig;
}

function generateCSSVariables(branding: BrandingConfig): React.CSSProperties {
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

function isBrandingCustom(branding: BrandingConfig): boolean {
  const defaultStr = JSON.stringify(DEFAULT_BRANDING);
  const currentStr = JSON.stringify(branding);
  return defaultStr !== currentStr;
}

export function ThemeProvider({ children, tenant, defaultBranding }: ThemeProviderProps) {
  const branding = tenant?.branding || defaultBranding || DEFAULT_BRANDING;
  
  const cssVariables = useMemo(() => generateCSSVariables(branding), [branding]);
  const isCustom = useMemo(() => isBrandingCustom(branding), [branding]);

  return (
    <ThemeContext.Provider value={{ branding, cssVariables, isCustom }}>
      <div style={cssVariables} className="min-h-screen">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { generateCSSVariables };