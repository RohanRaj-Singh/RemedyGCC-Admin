'use client';

import { ReactNode, CSSProperties } from 'react';
import { BrandingConfig } from '@/types';
import {
  brandingToCSSVars,
  getReadableTextColor,
  resolveBrandingConfig,
} from '@/types/branding';
import type { TenantStatus } from '@/modules/tenant/types';

interface BrandingWrapperProps {
  branding: BrandingConfig | null | undefined;
  children: ReactNode;
  className?: string;
}

export function BrandingWrapper({ branding, children, className }: BrandingWrapperProps) {
  const resolvedBranding = resolveBrandingConfig(branding);
  const cssVariables = getBrandingCSSVariables(resolvedBranding);

  return (
    <div className={className} style={cssVariables as CSSProperties}>
      {children}
    </div>
  );
}

export function getBrandingCSSVariables(branding: BrandingConfig): Record<string, string> {
  const resolved = resolveBrandingConfig(branding);
  return {
    ...brandingToCSSVars(resolved),
    '--brand-background': '#ffffff',
    '--brand-text': '#111827',
    '--brand-accent': resolved.secondaryColor,
  };
}

interface TenantBrandingCardProps {
  name: string;
  slug: string;
  branding: BrandingConfig;
  status: TenantStatus;
  runtimeConfigId?: string | null;
  onEditBranding?: () => void;
  onViewDetails?: () => void;
}

export function TenantBrandingCard({
  name,
  slug,
  branding,
  status,
  runtimeConfigId,
  onEditBranding,
  onViewDetails,
}: TenantBrandingCardProps) {
  const cssVars = getBrandingCSSVariables(branding);
  
  const statusColors = {
    draft: { bg: 'rgba(245, 158, 11, 0.12)', text: '#92400e' },
    active: { bg: 'hsl(142 76% 36% / 0.15)', text: 'hsl(142 76% 26%)' },
    disabled: { bg: 'rgba(148, 163, 184, 0.18)', text: '#475569' },
    archived: { bg: 'rgba(82, 82, 91, 0.16)', text: '#3f3f46' },
  };

  return (
    <div 
      className="rounded-2xl p-6 border shadow-sm hover:shadow-md transition-all"
      style={{ 
        backgroundColor: cssVars['--brand-background'],
        borderColor: 'var(--border)'
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: cssVars['--brand-primary'] }}
          >
            <span 
              className="text-2xl font-bold"
              style={{ color: getReadableTextColor(cssVars['--brand-primary']) }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-lg" style={{ color: cssVars['--brand-text'] }}>
              {name}
            </h3>
            <code className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {slug}.remedygcc.com
            </code>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onEditBranding && (
            <button
              onClick={onEditBranding}
              className="p-2 rounded-lg transition-colors hover:bg-slate-100"
              style={{ color: 'var(--muted-foreground)' }}
              title="Edit branding"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="p-2 rounded-lg transition-colors hover:bg-slate-100"
              style={{ color: 'var(--muted-foreground)' }}
              title="View details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span 
          className="px-3 py-1.5 rounded-lg text-sm font-medium"
          style={{ 
            backgroundColor: statusColors[status].bg, 
            color: statusColors[status].text 
          }}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        
        <div 
          className="w-8 h-8 rounded-lg"
          style={{ backgroundColor: cssVars['--brand-secondary'] }}
          title="Branding color preview"
        />
      </div>

      <div 
        className="pt-4 border-t flex justify-between text-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <div>
          <span className="font-medium" style={{ color: 'var(--foreground)' }}>
            {runtimeConfigId || 'No runtime config'}
          </span>
          <span style={{ color: 'var(--muted-foreground)' }}> runtime pointer</span>
        </div>
        
        <div>
          {runtimeConfigId ? (
            <span className="text-emerald-600 font-medium">Runtime linked</span>
          ) : (
            <span style={{ color: 'var(--muted-foreground)' }}>Draft only</span>
          )}
        </div>
      </div>
    </div>
  );
}
