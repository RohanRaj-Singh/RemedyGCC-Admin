/**
 * Runtime-safe tenant branding types and helpers.
 */

export interface BrandingGradients {
  brandGradient: string;
  heroGradient: string;
  headerGradient: string;
  pageGradient: string;
  dashboardGradient: string;
  cardGradient: string;
}

export interface BrandingConfig {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  fontFamily?: string;
  gradients?: Partial<BrandingGradients>;
  metadata?: Record<string, unknown>;
}

export interface ResolvedBrandingConfig {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl: string;
  fontFamily: string;
  gradients: BrandingGradients;
  metadata?: Record<string, unknown>;
}

export interface BrandingValidationResult {
  errors: string[];
  warnings: string[];
}

const DEFAULT_PRIMARY = '#f58220';
const DEFAULT_SECONDARY = '#f37820';
const DEFAULT_LOGO = '/images/logo.png';
const DEFAULT_TENANT_NAME = 'RemedyGCC';
const DEFAULT_FONT_FAMILY = 'Inter, system-ui, sans-serif';
const DEFAULT_FAVICON = '/favicon.ico';

export const DEFAULT_BRANDING: ResolvedBrandingConfig = {
  appName: DEFAULT_TENANT_NAME,
  logoUrl: DEFAULT_LOGO,
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  faviconUrl: DEFAULT_FAVICON,
  fontFamily: DEFAULT_FONT_FAMILY,
  gradients: buildDefaultGradients(DEFAULT_PRIMARY, DEFAULT_SECONDARY),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase();
  const shortMatch = /^#([0-9a-f]{3})$/.exec(normalized);
  if (shortMatch) {
    const expanded = shortMatch[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('');

    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }

  const longMatch = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!longMatch) {
    return null;
  }

  return {
    r: Number.parseInt(longMatch[1].slice(0, 2), 16),
    g: Number.parseInt(longMatch[1].slice(2, 4), 16),
    b: Number.parseInt(longMatch[1].slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function isValidHexColor(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function normalizeHexColor(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!isValidHexColor(trimmed)) {
    return fallback;
  }

  const rgb = hexToRgb(trimmed);
  return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : fallback;
}

export function mixHexColors(primary: string, secondary: string, ratio: number): string {
  const a = hexToRgb(normalizeHexColor(primary, DEFAULT_PRIMARY));
  const b = hexToRgb(normalizeHexColor(secondary, DEFAULT_SECONDARY));
  if (!a || !b) {
    return DEFAULT_SECONDARY;
  }

  const clampedRatio = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    a.r * (1 - clampedRatio) + b.r * clampedRatio,
    a.g * (1 - clampedRatio) + b.g * clampedRatio,
    a.b * (1 - clampedRatio) + b.b * clampedRatio,
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(normalizeHexColor(hex, DEFAULT_PRIMARY));
  if (!rgb) {
    return `rgba(245, 130, 32, ${alpha})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function getReadableTextColor(hex: string): '#111827' | '#ffffff' {
  const rgb = hexToRgb(normalizeHexColor(hex, DEFAULT_PRIMARY));
  if (!rgb) {
    return '#111827';
  }

  const luminance =
    (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

  return luminance > 0.62 ? '#111827' : '#ffffff';
}

function buildDefaultGradients(primary: string, secondary: string): BrandingGradients {
  return {
    brandGradient: `linear-gradient(135deg, ${primary}, ${secondary})`,
    heroGradient: `linear-gradient(135deg, ${hexToRgba(primary, 0.2)}, ${hexToRgba(
      secondary,
      0.08,
    )})`,
    headerGradient: `linear-gradient(90deg, ${primary}, ${secondary})`,
    pageGradient: `linear-gradient(180deg, ${hexToRgba(primary, 0.08)}, #ffffff 48%, ${hexToRgba(
      secondary,
      0.06,
    )})`,
    dashboardGradient: `linear-gradient(145deg, ${hexToRgba(primary, 0.16)}, ${hexToRgba(
      secondary,
      0.1,
    )})`,
    cardGradient: `linear-gradient(145deg, #ffffff, ${hexToRgba(primary, 0.07)})`,
  };
}

function mergeGradients(
  primaryColor: string,
  secondaryColor: string,
  gradients?: Partial<BrandingGradients>,
): BrandingGradients {
  const defaults = buildDefaultGradients(primaryColor, secondaryColor);

  return {
    brandGradient: gradients?.brandGradient?.trim() || defaults.brandGradient,
    heroGradient: gradients?.heroGradient?.trim() || defaults.heroGradient,
    headerGradient: gradients?.headerGradient?.trim() || defaults.headerGradient,
    pageGradient: gradients?.pageGradient?.trim() || defaults.pageGradient,
    dashboardGradient:
      gradients?.dashboardGradient?.trim() || defaults.dashboardGradient,
    cardGradient: gradients?.cardGradient?.trim() || defaults.cardGradient,
  };
}

export function isSafeAssetReference(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  );
}

export function isValidBrandingConfig(brand: unknown): brand is BrandingConfig {
  if (!isRecord(brand)) {
    return false;
  }

  if ('appName' in brand && brand.appName !== undefined && typeof brand.appName !== 'string') {
    return false;
  }
  if ('logoUrl' in brand && brand.logoUrl !== undefined && typeof brand.logoUrl !== 'string') {
    return false;
  }
  if (
    'primaryColor' in brand &&
    brand.primaryColor !== undefined &&
    typeof brand.primaryColor !== 'string'
  ) {
    return false;
  }
  if (
    'secondaryColor' in brand &&
    brand.secondaryColor !== undefined &&
    typeof brand.secondaryColor !== 'string'
  ) {
    return false;
  }
  if (
    'faviconUrl' in brand &&
    brand.faviconUrl !== undefined &&
    typeof brand.faviconUrl !== 'string'
  ) {
    return false;
  }
  if (
    'fontFamily' in brand &&
    brand.fontFamily !== undefined &&
    typeof brand.fontFamily !== 'string'
  ) {
    return false;
  }
  if ('gradients' in brand && brand.gradients !== undefined && !isRecord(brand.gradients)) {
    return false;
  }

  return true;
}

export function validateBrandingConfig(
  branding: Partial<BrandingConfig> | null | undefined,
): BrandingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!branding) {
    return {
      errors,
      warnings: [
        'Branding is missing and will fully fall back to runtime defaults until publish.',
      ],
    };
  }

  if (branding.primaryColor && !isValidHexColor(branding.primaryColor)) {
    errors.push('Primary color must be a valid hex value such as #f58220.');
  }

  if (branding.secondaryColor && !isValidHexColor(branding.secondaryColor)) {
    errors.push('Secondary color must be a valid hex value such as #f37820.');
  }

  if (branding.logoUrl && !isSafeAssetReference(branding.logoUrl)) {
    errors.push('Logo must use a relative asset path, HTTPS URL, or data image URL.');
  }

  if (branding.faviconUrl && !isSafeAssetReference(branding.faviconUrl)) {
    errors.push('Favicon must use a relative asset path, HTTPS URL, or data image URL.');
  }

  if (!branding.appName?.trim()) {
    warnings.push('App name is missing. Runtime will fall back to "RemedyGCC".');
  }

  if (!branding.logoUrl?.trim()) {
    warnings.push('Logo is missing. Runtime will fall back to the default logo.');
  }

  if (!branding.primaryColor?.trim()) {
    warnings.push('Primary color is missing. Runtime will fall back to the default primary color.');
  }

  if (!branding.secondaryColor?.trim()) {
    warnings.push(
      'Secondary color is missing. Runtime will derive a safe secondary color from the primary color.',
    );
  }

  if (!branding.faviconUrl?.trim()) {
    warnings.push('Favicon is missing. Runtime will fall back to the default favicon.');
  }

  if (!branding.fontFamily?.trim()) {
    warnings.push('Font family is missing. Runtime will fall back to the default font stack.');
  }

  if (!branding.gradients?.brandGradient?.trim() || !branding.gradients?.heroGradient?.trim()) {
    warnings.push('Brand gradients are incomplete. Runtime will derive safe gradients automatically.');
  }

  return { errors, warnings };
}

export function resolveBrandingConfig(
  branding: BrandingConfig | null | undefined,
): ResolvedBrandingConfig {
  const primaryColor = normalizeHexColor(branding?.primaryColor, DEFAULT_PRIMARY);
  const secondaryColor = branding?.secondaryColor?.trim()
    ? normalizeHexColor(branding.secondaryColor, DEFAULT_SECONDARY)
    : mixHexColors(primaryColor, DEFAULT_SECONDARY, 0.55);

  return {
    appName: branding?.appName?.trim() || DEFAULT_TENANT_NAME,
    logoUrl:
      branding?.logoUrl && isSafeAssetReference(branding.logoUrl)
        ? branding.logoUrl.trim()
        : DEFAULT_LOGO,
    primaryColor,
    secondaryColor,
    faviconUrl:
      branding?.faviconUrl && isSafeAssetReference(branding.faviconUrl)
        ? branding.faviconUrl.trim()
        : DEFAULT_FAVICON,
    fontFamily: branding?.fontFamily?.trim() || DEFAULT_FONT_FAMILY,
    gradients: mergeGradients(primaryColor, secondaryColor, branding?.gradients),
    metadata: branding?.metadata,
  };
}

export function getBrandingWithDefault(
  branding: BrandingConfig | null | undefined,
): ResolvedBrandingConfig {
  return resolveBrandingConfig(branding);
}

export function brandingToCSSVars(
  branding: BrandingConfig | ResolvedBrandingConfig | null | undefined,
): Record<string, string> {
  const resolved = resolveBrandingConfig(branding);

  return {
    '--brand-primary': resolved.primaryColor,
    '--brand-secondary': resolved.secondaryColor,
    '--brand-font': resolved.fontFamily,
    '--brand-logo': resolved.logoUrl,
    '--brand-favicon': resolved.faviconUrl,
    '--brand-gradient': resolved.gradients.brandGradient,
    '--brand-hero-gradient': resolved.gradients.heroGradient,
    '--brand-header-gradient': resolved.gradients.headerGradient,
    '--brand-page-gradient': resolved.gradients.pageGradient,
    '--brand-dashboard-gradient': resolved.gradients.dashboardGradient,
    '--brand-card-gradient': resolved.gradients.cardGradient,
    '--brand-on-primary': getReadableTextColor(resolved.primaryColor),
    '--brand-on-secondary': getReadableTextColor(resolved.secondaryColor),
  };
}

export function isDefaultBranding(
  branding: BrandingConfig | ResolvedBrandingConfig | null | undefined,
): boolean {
  const resolved = resolveBrandingConfig(branding);
  return JSON.stringify(resolved) === JSON.stringify(DEFAULT_BRANDING);
}
