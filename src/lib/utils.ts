import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BrandingConfig } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';

/**
 * Utility function to merge Tailwind CSS classes
 * Used for composing component classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'inactive':
      return 'bg-gray-100 text-gray-800';
    case 'suspended':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get log level color class
 */
export function getLogLevelColor(level: string): string {
  switch (level) {
    case 'info':
      return 'bg-blue-100 text-blue-800';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Check if branding is custom (not default)
 */
export function isCustomBranding(branding: BrandingConfig): boolean {
  return JSON.stringify(branding) !== JSON.stringify(DEFAULT_BRANDING);
}

/**
 * Get branding status info
 */
export function getBrandingStatus(branding: BrandingConfig): {
  isCustom: boolean;
  label: string;
  colorClass: string;
  bgClass: string;
} {
  const custom = isCustomBranding(branding);
  return {
    isCustom: custom,
    label: custom ? 'Custom' : 'Default',
    colorClass: custom ? 'text-violet-700' : 'text-slate-600',
    bgClass: custom ? 'bg-violet-50' : 'bg-slate-100',
  };
}

/**
 * Convert HSL color string to CSS variable reference
 */
export function hslToCssVar(color: string): string {
  return `hsl(var(--brand-${color}))`;
}

/**
 * Generate inline style object from branding
 */
export function brandingToInlineStyle(branding: BrandingConfig): React.CSSProperties {
  return {
    '--brand-primary': branding.colorScheme.primaryColor,
    '--brand-secondary': branding.colorScheme.secondaryColor || branding.colorScheme.primaryColor,
    '--brand-background': branding.colorScheme.backgroundColor || '0 0% 100%',
    '--brand-text': branding.colorScheme.textColor || '0 0% 43%',
    '--brand-accent': branding.colorScheme.accentColor || '212 100% 50%',
  } as React.CSSProperties;
}