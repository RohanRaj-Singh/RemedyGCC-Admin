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
  logo?: string;
  backgroundImage?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  faviconUrl?: string;
  gradient?: Partial<BrandingGradients>;
  chartColors?: string[];
  themeMode?: "light" | "dark";
  metadata?: Record<string, unknown>;
}

export interface ResolvedBrandingConfig {
  appName: string;
  logo: string;
  backgroundImage: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  faviconUrl: string;
  gradient: BrandingGradients;
  chartColors: string[];
  themeMode: "light" | "dark";
  metadata?: Record<string, unknown>;
}

export interface BrandingValidationResult {
  errors: string[];
  warnings: string[];
}

const DEFAULT_PRIMARY = '#f58220';
const DEFAULT_SECONDARY = '#f37820';
const DEFAULT_LOGO = '/default/logo.png';
const DEFAULT_BACKGROUND_IMAGE = '/default/background.png';
const DEFAULT_TENANT_NAME = 'RemedyGCC';
const DEFAULT_FAVICON = '/favicon.ico';

export const DEFAULT_BRANDING: ResolvedBrandingConfig = {
  appName: DEFAULT_TENANT_NAME,
  logo: DEFAULT_LOGO,
  backgroundImage: DEFAULT_BACKGROUND_IMAGE,
  logoUrl: DEFAULT_LOGO,
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  faviconUrl: DEFAULT_FAVICON,
  gradient: buildDefaultGradients(DEFAULT_PRIMARY, DEFAULT_SECONDARY),
  chartColors: [DEFAULT_PRIMARY, DEFAULT_SECONDARY, '#A0A0A0', '#6B6B6B', '#2E2E2E'], // Example defaults, can be refined
  themeMode: "light", // Default theme mode
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

function getLuminance(hex: string): number {
  const rgb = hexToRgb(normalizeHexColor(hex, DEFAULT_PRIMARY));
  if (!rgb) {
    return 0; // Or a reasonable default for non-parseable colors
  }

  const R = rgb.r / 255;
  const G = rgb.g / 255;
  const B = rgb.b / 255;

  const r = R <= 0.03928 ? R / 12.92 : ((R + 0.055) / 1.055) ** 2.4;
  const g = G <= 0.03928 ? G / 12.92 : ((G + 0.055) / 1.055) ** 2.4;
  const b = B <= 0.03928 ? B / 12.92 : ((B + 0.055) / 1.055) ** 2.4;

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function hasDuplicateColors(colors: string[]): boolean {
  if (!colors || colors.length <= 1) {
    return false;
  }
  const normalizedColors = colors.map(color => normalizeHexColor(color, "").toLowerCase()).filter(Boolean);
  const uniqueColors = new Set(normalizedColors);
  return uniqueColors.size !== normalizedColors.length;
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
  gradient?: Partial<BrandingGradients>,
): BrandingGradients {
  const defaults = buildDefaultGradients(primaryColor, secondaryColor);

  return {
    brandGradient: gradient?.brandGradient?.trim() || defaults.brandGradient,
    heroGradient: gradient?.heroGradient?.trim() || defaults.heroGradient,
    headerGradient: gradient?.headerGradient?.trim() || defaults.headerGradient,
    pageGradient: gradient?.pageGradient?.trim() || defaults.pageGradient,
    dashboardGradient:
      gradient?.dashboardGradient?.trim() || defaults.dashboardGradient,
    cardGradient: gradient?.cardGradient?.trim() || defaults.cardGradient,
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

function getLogoReference(branding: BrandingConfig | null | undefined): string | undefined {
  return branding?.logo?.trim() || branding?.logoUrl?.trim() || undefined;
}

export function isValidBrandingConfig(brand: unknown): brand is BrandingConfig {
  if (!isRecord(brand)) {
    return false;
  }

  if ('appName' in brand && brand.appName !== undefined && typeof brand.appName !== 'string') {
    return false;
  }
  if ('logo' in brand && brand.logo !== undefined && typeof brand.logo !== 'string') {
    return false;
  }
  if (
    'backgroundImage' in brand
    && brand.backgroundImage !== undefined
    && typeof brand.backgroundImage !== 'string'
  ) {
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
  if ('gradient' in brand && brand.gradient !== undefined && !isRecord(brand.gradient)) {
    return false;
  }

  if (
    'chartColors' in brand &&
    brand.chartColors !== undefined &&
    (!Array.isArray(brand.chartColors) ||
      !brand.chartColors.every((color) => typeof color === 'string'))
  ) {
    return false;
  }

  if (
    'themeMode' in brand &&
    brand.themeMode !== undefined &&
    (brand.themeMode !== 'light' && brand.themeMode !== 'dark')
  ) {
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
        'Brand styling has not been customized yet. Safe default styling will be used until you publish.',
      ],
    };
  }

  if (branding.primaryColor && !isValidHexColor(branding.primaryColor)) {
    errors.push('Primary color must be a valid hex value such as #f58220.');
  }

  if (branding.secondaryColor && !isValidHexColor(branding.secondaryColor)) {
    errors.push('Secondary color must be a valid hex value such as #f37820.');
  }

  const logoReference = getLogoReference(branding);
  if (logoReference && !isSafeAssetReference(logoReference)) {
    errors.push('Logo must use a relative asset path, HTTPS URL, or data image URL.');
  }

  if (branding.backgroundImage && !isSafeAssetReference(branding.backgroundImage)) {
    errors.push('Background image must use a relative asset path, HTTPS URL, or data image URL.');
  }

  if (branding.faviconUrl && !isSafeAssetReference(branding.faviconUrl)) {
    errors.push('Favicon must use a relative asset path, HTTPS URL, or data image URL.');
  }

  if (!branding.appName?.trim()) {
    warnings.push('App name is missing. The default survey name will be used.');
  }

  if (!logoReference) {
    warnings.push('Logo is missing. The default logo will be used.');
  }

  if (!branding.backgroundImage?.trim()) {
    warnings.push('Background image is missing. The default background will be used.');
  }

  if (!branding.primaryColor?.trim()) {
    warnings.push('Primary color is missing. The default brand color will be used.');
  }

  if (!branding.secondaryColor?.trim()) {
    warnings.push(
      'Secondary color is missing. A matching accent color will be used automatically.',
    );
  }

  if (!branding.faviconUrl?.trim()) {
    warnings.push('Browser icon is missing. The default icon will be used.');
  }

  if (!branding.gradient?.brandGradient?.trim() || !branding.gradient?.heroGradient?.trim()) {
    warnings.push('Optional gradient styling is incomplete. Default styling will be used safely.');
  }

  if (branding.chartColors && hasDuplicateColors(branding.chartColors)) {
    errors.push("Chart colors contain duplicate values. Please ensure all chart colors are unique.");
  }

  // Basic contrast checks for primary/secondary against a assumed light background (#FFFFFF)
  // The runtime will do full accessibility adjustments via ensureAccessibleColor()
  if (branding.primaryColor) {
    const contrastWithWhite = getContrastRatio(branding.primaryColor, "#FFFFFF");
    if (contrastWithWhite < 3) { // WCAG AA for large text is 3:1
      warnings.push('Primary color may be hard to read on light backgrounds. Consider a darker shade.');
    }
  }

  if (branding.secondaryColor) {
    const contrastWithWhite = getContrastRatio(branding.secondaryColor, "#FFFFFF");
    if (contrastWithWhite < 3) { // WCAG AA for large text is 3:1
      warnings.push('Secondary color may be hard to read on light backgrounds. Consider a darker shade.');
    }
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
    logo:
      getLogoReference(branding) && isSafeAssetReference(getLogoReference(branding))
        ? getLogoReference(branding)!.trim()
        : DEFAULT_LOGO,
    backgroundImage:
      branding?.backgroundImage && isSafeAssetReference(branding.backgroundImage)
        ? branding.backgroundImage.trim()
        : DEFAULT_BACKGROUND_IMAGE,
    logoUrl:
      getLogoReference(branding) && isSafeAssetReference(getLogoReference(branding))
        ? getLogoReference(branding)!.trim()
        : DEFAULT_LOGO,
    primaryColor,
    secondaryColor,
    faviconUrl:
      branding?.faviconUrl && isSafeAssetReference(branding.faviconUrl)
        ? branding.faviconUrl.trim()
        : DEFAULT_FAVICON,
    gradient: mergeGradients(primaryColor, secondaryColor, branding?.gradient),
    chartColors: branding?.chartColors && Array.isArray(branding.chartColors) ? branding.chartColors.map(c => normalizeHexColor(c, '#000000')) : DEFAULT_BRANDING.chartColors,
    themeMode: branding?.themeMode === "light" || branding?.themeMode === "dark" ? branding.themeMode : DEFAULT_BRANDING.themeMode,
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
    '--brand-logo': resolved.logo,
    '--brand-background-image': `url("${resolved.backgroundImage}")`,
    '--brand-favicon': resolved.faviconUrl,
    '--brand-gradient': resolved.gradient.brandGradient,
    '--brand-hero-gradient': resolved.gradient.heroGradient,
    '--brand-header-gradient': resolved.gradient.headerGradient,
    '--brand-page-gradient': resolved.gradient.pageGradient,
    '--brand-dashboard-gradient': resolved.gradient.dashboardGradient,
    '--brand-card-gradient': resolved.gradient.cardGradient,
    '--brand-on-primary': getReadableTextColor(resolved.primaryColor),
    '--brand-on-secondary': getReadableTextColor(resolved.secondaryColor),
    '--brand-chart-colors': resolved.chartColors.join(", "), // For CSS usage
    '--brand-theme-mode': resolved.themeMode,
  };
}

export function isDefaultBranding(
  branding: BrandingConfig | ResolvedBrandingConfig | null | undefined,
): boolean {
  const resolved = resolveBrandingConfig(branding);
  return JSON.stringify(resolved) === JSON.stringify(DEFAULT_BRANDING);
}
