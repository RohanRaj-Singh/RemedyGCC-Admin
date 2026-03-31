/**
 * Branding Types for Per-Tenant White-label Configuration
 * Replaces legacy TenantPlan system
 */

// Color scheme configuration
export interface ColorScheme {
  primaryColor: string;      // hsl format: "156 63% 16%"
  secondaryColor?: string;    // hsl format
  backgroundColor?: string;  // hsl format
  textColor?: string;        // hsl format
  accentColor?: string;      // hsl format
}

// Branding assets
export interface BrandingAssets {
  headerImageUrl?: string;
  footerImageUrl?: string;
  customCss?: string;
}

// Complete branding configuration
export interface BrandingConfig {
  logoUrl: string;
  faviconUrl?: string;
  colorScheme: ColorScheme;
  fontFamily?: string;
  assets?: BrandingAssets;
  metadata?: Record<string, unknown>;
}

// Default branding fallback
export const DEFAULT_BRANDING: BrandingConfig = {
  logoUrl: '/default-logo.svg',
  colorScheme: {
    primaryColor: '156 63% 16%',
    secondaryColor: '0 0% 96%',
    backgroundColor: '0 0% 100%',
    textColor: '0 0% 43%',
    accentColor: '212 100% 50%',
  },
  fontFamily: 'Satoshi, Inter, sans-serif',
};

// Type guard for branding
export function isValidBrandingConfig(brand: unknown): brand is BrandingConfig {
  if (!brand || typeof brand !== 'object') return false;
  const b = brand as Partial<BrandingConfig>;
  return typeof b.logoUrl === 'string' && typeof b.colorScheme === 'object';
}

// Get branding with fallback
export function getBrandingWithDefault(brand: BrandingConfig | null | undefined): BrandingConfig {
  if (brand && isValidBrandingConfig(brand)) {
    return brand;
  }
  return DEFAULT_BRANDING;
}

// Convert color scheme to CSS variables
export function colorSchemeToCSSVars(scheme: ColorScheme): Record<string, string> {
  return {
    '--brand-primary': scheme.primaryColor,
    '--brand-secondary': scheme.secondaryColor ?? scheme.primaryColor,
    '--brand-background': scheme.backgroundColor ?? '0 0% 100%',
    '--brand-text': scheme.textColor ?? '0 0% 43%',
    '--brand-accent': scheme.accentColor ?? '212 100% 50%',
  };
}