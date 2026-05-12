'use client';

import { createContext, useContext, ReactNode, useMemo } from 'react';
import { BrandingConfig } from '@/types';
import {
  brandingToCSSVars,
  isDefaultBranding,
  resolveBrandingConfig,
} from '@/types/branding';
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
  const resolved = resolveBrandingConfig(branding);
  return {
    ...brandingToCSSVars(resolved),
    // Dynamically set background and text colors based on themeMode
    '--brand-background': resolved.themeMode === "dark" ? "#111827" : "#ffffff",
    '--brand-text': resolved.themeMode === "dark" ? "#ffffff" : "#111827",
    '--brand-accent': resolved.secondaryColor,
  } as React.CSSProperties;
}

function isBrandingCustom(branding: BrandingConfig): boolean {
  return !isDefaultBranding(branding);
}

export function ThemeProvider({ children, tenant, defaultBranding }: ThemeProviderProps) {
  const branding = tenant?.branding || defaultBranding || {};
  const resolvedBranding = useMemo(() => resolveBrandingConfig(branding), [branding]);
  
  const cssVariables = useMemo(() => generateCSSVariables(branding), [branding]);
  const isCustom = useMemo(() => isBrandingCustom(branding), [branding]);

  return (
    <ThemeContext.Provider value={{ branding: resolvedBranding, cssVariables, isCustom }}>
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
