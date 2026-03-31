'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ImageOff } from 'lucide-react';
import { BrandingConfig } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';
import { ImageUploader } from './ImageUploader';
import { ColorPicker } from './ColorPicker';

interface BrandingPanelProps {
  branding: Partial<BrandingConfig>;
  onChange: Dispatch<SetStateAction<Partial<BrandingConfig>>>;
  title?: string;
  showPreviewSection?: boolean;
}

interface BrandingPreviewCardProps {
  branding: Partial<BrandingConfig>;
  title?: string;
  description?: string;
}

interface BrandingPreviewProps {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  primaryValue: string;
  secondaryValue: string;
  accentValue: string;
  textValue: string;
  backgroundValue: string;
}

interface BrandingPreviewData {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  primaryValue: string;
  secondaryValue: string;
  accentValue: string;
  textValue: string;
  backgroundValue: string;
}

function toCssColor(color: string | undefined, fallback: string): string {
  const resolvedColor = color || fallback;
  const match = resolvedColor.match(
    /^(\d+)\s+(\d+%)\s+(\d+%)(?:\s*\/\s*(\d+(?:\.\d+)?%))?$/
  );

  if (match) {
    const [, hue, saturation, lightness, alpha] = match;
    const alphaValue = alpha
      ? Number.parseFloat(alpha.replace('%', '')) / 100
      : undefined;
    return alpha
      ? `hsla(${hue}, ${saturation}, ${lightness}, ${alphaValue})`
      : `hsl(${hue}, ${saturation}, ${lightness})`;
  }

  return resolvedColor;
}

function PreviewLogo({ logoUrl, primaryColor }: { logoUrl?: string; primaryColor: string }) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [logoUrl]);

  if (!logoUrl || hasImageError) {
    return (
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
          borderColor: 'hsl(0 0% 100% / 0.35)',
        }}
      >
        {logoUrl ? (
          <ImageOff className="w-5 h-5 text-white" />
        ) : (
          <span className="font-bold text-white">T</span>
        )}
      </div>
    );
  }

  return (
    <div className="w-12 h-12 rounded-2xl border overflow-hidden bg-white shadow-sm">
      <img
        src={logoUrl}
        alt="Tenant branding logo preview"
        className="w-full h-full object-contain"
        onError={() => setHasImageError(true)}
      />
    </div>
  );
}

function getBrandingPreviewData(branding: Partial<BrandingConfig>): BrandingPreviewData {
  const colorScheme = {
    ...DEFAULT_BRANDING.colorScheme,
    ...branding.colorScheme,
  };

  const primaryValue = colorScheme.primaryColor;
  const secondaryValue = colorScheme.secondaryColor || DEFAULT_BRANDING.colorScheme.secondaryColor || '';
  const accentValue = colorScheme.accentColor || DEFAULT_BRANDING.colorScheme.accentColor || '';
  const textValue = colorScheme.textColor || DEFAULT_BRANDING.colorScheme.textColor || '0 0% 43%';
  const backgroundValue = colorScheme.backgroundColor || DEFAULT_BRANDING.colorScheme.backgroundColor || '0 0% 100%';

  return {
    logoUrl: branding.logoUrl,
    primaryColor: toCssColor(primaryValue, DEFAULT_BRANDING.colorScheme.primaryColor),
    secondaryColor: toCssColor(secondaryValue, DEFAULT_BRANDING.colorScheme.secondaryColor || primaryValue),
    accentColor: toCssColor(accentValue, DEFAULT_BRANDING.colorScheme.accentColor || primaryValue),
    textColor: toCssColor(textValue, DEFAULT_BRANDING.colorScheme.textColor || '0 0% 43%'),
    bgColor: toCssColor(backgroundValue, DEFAULT_BRANDING.colorScheme.backgroundColor || '0 0% 100%'),
    primaryValue,
    secondaryValue,
    accentValue,
    textValue,
    backgroundValue,
  };
}

function BrandingPreview({
  logoUrl,
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  bgColor,
  primaryValue,
  secondaryValue,
  accentValue,
  textValue,
  backgroundValue,
}: BrandingPreviewProps) {
  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: bgColor,
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="h-3 w-full"
        style={{
          background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
        }}
      />

      <div className="p-4 space-y-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg, ${secondaryColor}, ${bgColor})`,
            border: `1px solid ${primaryColor}22`,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <PreviewLogo logoUrl={logoUrl} primaryColor={primaryColor} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: textColor }}>
                Tenant Name
              </p>
              <p className="text-xs" style={{ color: textColor }}>
                Live branding preview
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Primary
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{
                backgroundColor: secondaryColor,
                borderColor: primaryColor,
                color: textColor,
              }}
            >
              Secondary
            </button>
            <span
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                backgroundColor: accentColor,
                color: '#fff',
              }}
            >
              Accent
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl border p-3 space-y-2"
          style={{
            backgroundColor: bgColor,
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: textColor }}>
              Reading Preview
            </p>
            <span
              className="text-[10px] px-2 py-1 rounded-full font-semibold"
              style={{ backgroundColor: accentColor, color: '#fff' }}
            >
              Highlight
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: textColor }}>
            Clear text on the chosen background should stay easy to read.
          </p>
          <p className="text-xs" style={{ color: textColor }}>
            Use background for page surfaces and text for titles, labels, and body copy.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="h-10 rounded-lg mb-2" style={{ backgroundColor: primaryColor }} />
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: textColor }}>
              Primary
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: textColor }}>
              {primaryValue}
            </p>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="h-10 rounded-lg mb-2" style={{ backgroundColor: secondaryColor }} />
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: textColor }}>
              Secondary
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: textColor }}>
              {secondaryValue}
            </p>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
            <div className="h-10 rounded-lg mb-2" style={{ backgroundColor: accentColor }} />
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: textColor }}>
              Accent
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: textColor }}>
              {accentValue}
            </p>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)', backgroundColor: bgColor }}>
            <div className="h-10 rounded-lg mb-2 border" style={{ backgroundColor: bgColor, borderColor: secondaryColor }} />
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: textColor }}>
              Background
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: textColor }}>
              {backgroundValue}
            </p>
          </div>
          <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)', backgroundColor: bgColor }}>
            <div className="h-10 rounded-lg mb-2 flex items-center px-2" style={{ backgroundColor: secondaryColor }}>
              <span className="text-xs font-semibold" style={{ color: textColor }}>
                Aa
              </span>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: textColor }}>
              Text
            </p>
            <p className="text-[10px] font-mono mt-1 break-all" style={{ color: textColor }}>
              {textValue}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrandingPreviewCard({
  branding,
  title = 'Live Preview',
  description = 'Updates instantly as you adjust the branding settings.',
}: BrandingPreviewCardProps) {
  const previewData = useMemo(() => getBrandingPreviewData(branding), [branding]);

  return (
    <div
      className="rounded-xl border shadow-sm p-5 h-fit w-full"
      style={{
        backgroundColor: 'hsl(0 0% 98%)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
            {title}
          </h3>
          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {description}
          </p>
        </div>
      </div>

      <BrandingPreview
        key={[
          previewData.primaryValue,
          previewData.secondaryValue,
          previewData.accentValue,
          previewData.textValue,
          previewData.backgroundValue,
          previewData.logoUrl || '',
        ].join('|')}
        {...previewData}
      />
    </div>
  );
}

export function BrandingPanel({
  branding,
  onChange,
  title = 'Branding',
  showPreviewSection = true,
}: BrandingPanelProps) {
  const colorScheme = useMemo(() => ({
    ...DEFAULT_BRANDING.colorScheme,
    ...branding.colorScheme,
  }), [branding.colorScheme]);

  const primaryColorValue = colorScheme.primaryColor;
  const secondaryColorValue = colorScheme.secondaryColor || DEFAULT_BRANDING.colorScheme.secondaryColor || '';
  const accentColorValue = colorScheme.accentColor || DEFAULT_BRANDING.colorScheme.accentColor || '';
  const textColorValue = colorScheme.textColor || DEFAULT_BRANDING.colorScheme.textColor || '0 0% 43%';
  const backgroundColorValue = colorScheme.backgroundColor || DEFAULT_BRANDING.colorScheme.backgroundColor || '0 0% 100%';
  const previewData = useMemo(() => getBrandingPreviewData(branding), [branding]);

  const handleLogoUrlChange = useCallback((url: string | null) => {
    onChange((current) => ({
      ...current,
      logoUrl: url || undefined,
    }));
  }, [onChange]);

  const handlePrimaryColorChange = useCallback((color: string) => {
    onChange((current) => ({
      ...current,
      colorScheme: {
        ...DEFAULT_BRANDING.colorScheme,
        ...current.colorScheme,
        primaryColor: color,
      },
    }));
  }, [onChange]);

  const handleSecondaryColorChange = useCallback((color: string) => {
    onChange((current) => ({
      ...current,
      colorScheme: {
        ...DEFAULT_BRANDING.colorScheme,
        ...current.colorScheme,
        secondaryColor: color,
      },
    }));
  }, [onChange]);

  const handleAccentColorChange = useCallback((color: string) => {
    onChange((current) => ({
      ...current,
      colorScheme: {
        ...DEFAULT_BRANDING.colorScheme,
        ...current.colorScheme,
        accentColor: color,
      },
    }));
  }, [onChange]);

  const handleBackgroundColorChange = useCallback((color: string) => {
    onChange((current) => ({
      ...current,
      colorScheme: {
        ...DEFAULT_BRANDING.colorScheme,
        ...current.colorScheme,
        backgroundColor: color,
      },
    }));
  }, [onChange]);

  const handleTextColorChange = useCallback((color: string) => {
    onChange((current) => ({
      ...current,
      colorScheme: {
        ...DEFAULT_BRANDING.colorScheme,
        ...current.colorScheme,
        textColor: color,
      },
    }));
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange(DEFAULT_BRANDING);
  }, [onChange]);

  return (
    <div
      className="rounded-xl border shadow-sm p-5 h-fit w-full"
      style={{
        backgroundColor: 'hsl(0 0% 98%)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-5">
        {showPreviewSection && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Live Preview
              </h4>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Updates instantly
              </span>
            </div>
            <BrandingPreview
              key={[
                previewData.primaryValue,
                previewData.secondaryValue,
                previewData.accentValue,
                previewData.textValue,
                previewData.backgroundValue,
                previewData.logoUrl || '',
              ].join('|')}
              {...previewData}
            />
          </div>
        )}

        <div className="border-t pt-5 space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <ImageUploader
              value={branding.logoUrl}
              onChange={handleLogoUrlChange}
              label="Logo Image"
              placeholder="Upload logo"
            />
          </div>

          <h4 className="text-sm font-medium mb-4" style={{ color: 'var(--foreground)' }}>
            Color Scheme
          </h4>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Keep it simple: choose a main brand color, a soft surface color, a highlight, plus readable page and text colors.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <ColorPicker
                value={primaryColorValue}
                onChange={handlePrimaryColorChange}
                label="Primary Action"
              />
            </div>

            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <ColorPicker
                value={secondaryColorValue}
                onChange={handleSecondaryColorChange}
                label="Secondary Surface"
              />
            </div>

            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <ColorPicker
                value={accentColorValue}
                onChange={handleAccentColorChange}
                label="Highlight"
              />
            </div>

            <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <ColorPicker
                value={backgroundColorValue}
                onChange={handleBackgroundColorChange}
                label="Page Background"
              />
            </div>

            <div className="rounded-xl border p-3 sm:col-span-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
              <ColorPicker
                value={textColorValue}
                onChange={handleTextColorChange}
                label="Text"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
