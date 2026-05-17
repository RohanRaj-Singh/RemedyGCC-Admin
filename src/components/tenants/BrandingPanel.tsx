'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { AlertTriangle, ImageOff, Sparkles } from 'lucide-react';
import { BrandingConfig } from '@/types';
import {
  DEFAULT_BRANDING,
  getReadableTextColor,
  resolveBrandingConfig,
  validateBrandingConfig,
} from '@/types/branding';
import { getTenantHostname } from '@/modules/tenant/utils';
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

function PreviewLogo({
  logoUrl,
  fallbackColor,
  fallbackText,
}: {
  logoUrl?: string;
  fallbackColor: string;
  fallbackText: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  if (!logoUrl || hasError) {
    return (
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm"
        style={{
          background: `linear-gradient(135deg, ${fallbackColor}, ${fallbackColor}cc)`,
          color: fallbackText,
        }}
      >
        {logoUrl ? <ImageOff className="h-5 w-5" /> : <span className="font-bold">S</span>}
      </div>
    );
  }

  return (
    <div className="h-12 w-12 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <img
        src={logoUrl}
        alt="Survey branding logo preview"
        className="h-full w-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function GradientChip({ label, gradient }: { label: string; gradient: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="h-10 rounded-lg" style={{ background: gradient }} />
      <p
        className="mt-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--foreground)' }}
      >
        {label}
      </p>
    </div>
  );
}

function BrandingPreview({ branding }: { branding: Partial<BrandingConfig> }) {
  const resolved = useMemo(() => resolveBrandingConfig(branding), [branding]);
  const onPrimary = getReadableTextColor(resolved.primaryColor);

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: 'var(--border)', backgroundColor: '#ffffff' }}
    >
      <div className="h-3 w-full" style={{ background: resolved.gradient.brandGradient }} />

      <div className="space-y-4 p-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: resolved.gradient.heroGradient,
            border: `1px solid ${resolved.primaryColor}22`,
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <PreviewLogo
              logoUrl={resolved.logoUrl}
              fallbackColor={resolved.primaryColor}
              fallbackText={onPrimary}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: '#111827' }}>
                {resolved.appName}
              </p>
              <p className="text-xs" style={{ color: '#4b5563' }}>
                {getTenantHostname('survey')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: resolved.primaryColor, color: onPrimary }}
            >
              Start Survey
            </div>
            <div
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: resolved.secondaryColor,
                borderColor: resolved.primaryColor,
                color: getReadableTextColor(resolved.secondaryColor),
              }}
            >
              Learn More
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <GradientChip label="Brand Accent" gradient={resolved.gradient.brandGradient} />
          <GradientChip label="Header Highlight" gradient={resolved.gradient.heroGradient} />
        </div>
      </div>
    </div>
  );
}

export function BrandingPreviewCard({
  branding,
  title = 'Brand Preview',
  description = 'Preview how the survey theme will look using safe defaults where needed.',
}: BrandingPreviewCardProps) {
  return (
    <div
      className="h-fit w-full rounded-xl border p-5 shadow-sm"
      style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>

      <BrandingPreview branding={branding} />
    </div>
  );
}

export function BrandingPanel({
  branding,
  onChange,
  title = 'Branding',
  showPreviewSection = true,
}: BrandingPanelProps) {
  const resolved = useMemo(() => resolveBrandingConfig(branding), [branding]);
  const validation = useMemo(() => validateBrandingConfig(branding), [branding]);

  const updateBrandingField = useCallback(
    <Key extends keyof BrandingConfig>(key: Key, value: BrandingConfig[Key]) => {
      onChange((current) => ({
        ...current,
        [key]: value,
      }));
    },
    [onChange],
  );

  const updateGradient = useCallback(
    (key: keyof NonNullable<BrandingConfig['gradient']>, value: string) => {
      onChange((current) => ({
        ...current,
        gradient: {
          ...current.gradient,
          [key]: value,
        },
      }));
    },
    [onChange],
  );

  const handleChartColorsChange = useCallback((value: string) => {
    const colors = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    updateBrandingField('chartColors', colors);
  }, [updateBrandingField]);

  const handleReset = useCallback(() => {
    onChange({
      appName: DEFAULT_BRANDING.appName,
      logoUrl: DEFAULT_BRANDING.logoUrl,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      secondaryColor: DEFAULT_BRANDING.secondaryColor,
      faviconUrl: DEFAULT_BRANDING.faviconUrl,
      gradient: DEFAULT_BRANDING.gradient,
      chartColors: DEFAULT_BRANDING.chartColors,
      themeMode: DEFAULT_BRANDING.themeMode,
    });
  }, [onChange]);

  const inputStyle =
    'w-full rounded-lg border border-[var(--input)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

  return (
    <div
      className="h-fit w-full rounded-xl border p-5 shadow-sm"
      style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Customize the survey look and feel. Missing items safely fall back to default styling.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm transition-colors hover:text-slate-700"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Use Defaults
        </button>
      </div>

      <div className="space-y-5">
        {validation.errors.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'hsl(0 84% 60% / 0.08)',
              borderColor: 'hsl(0 84% 60% / 0.22)',
            }}
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
              Branding needs attention
            </p>
            <div className="mt-2 space-y-1 text-sm" style={{ color: 'var(--destructive)' }}>
              {validation.errors.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#b45309' }} />
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                Branding notes
              </p>
            </div>
            <div className="space-y-1 text-sm" style={{ color: '#92400e' }}>
              {validation.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        )}

        {showPreviewSection && <BrandingPreview branding={branding} />}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Survey Name
            </label>
            <input
              type="text"
              value={branding.appName ?? ''}
              onChange={(event) => updateBrandingField('appName', event.target.value)}
              className={inputStyle}
              placeholder={DEFAULT_BRANDING.appName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Display Mode
            </label>
            <select
              value={branding.themeMode ?? 'light'}
              onChange={(event) =>
                updateBrandingField('themeMode', event.target.value as 'light' | 'dark')}
              className={inputStyle}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <ImageUploader
              value={branding.logoUrl}
              onChange={(url) => updateBrandingField('logoUrl', url ?? '')}
              label="Logo"
              placeholder="Upload company logo"
            />
          </div>

          <div
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <ImageUploader
              value={branding.faviconUrl}
              onChange={(url) => updateBrandingField('faviconUrl', url ?? '')}
              label="Browser Icon"
              placeholder="Upload browser icon"
              maxSizeMB={2}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <ColorPicker
              value={resolved.primaryColor}
              onChange={(color) => updateBrandingField('primaryColor', color)}
              label="Primary Color"
            />
          </div>

          <div
            className="rounded-xl border p-3"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
          >
            <ColorPicker
              value={resolved.secondaryColor}
              onChange={(color) => updateBrandingField('secondaryColor', color)}
              label="Secondary Color"
            />
          </div>
        </div>

        <details
          className="rounded-xl border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
        >
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              Advanced Styling
            </span>
            <span style={{ color: 'var(--muted-foreground)' }}>Optional</span>
          </summary>

          <div className="space-y-4 border-t px-4 py-4" style={{ borderColor: 'var(--border)' }}>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Chart Colors
              </label>
              <input
                type="text"
                value={branding.chartColors?.join(', ') ?? resolved.chartColors.join(', ')}
                onChange={(event) => handleChartColorsChange(event.target.value)}
                className={inputStyle}
                placeholder="#f58220, #f37820, #a0a0a0"
              />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Use comma-separated hex colors for charts and summary visuals.
              </p>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', backgroundColor: 'hsl(0 0% 99%)' }}
            >
              <div className="mb-3">
                <h4 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  Optional Gradient Overrides
                </h4>
                <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Leave these blank to use the standard brand styling automatically.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    Brand Gradient
                  </label>
                  <input
                    type="text"
                    value={branding.gradient?.brandGradient ?? ''}
                    onChange={(event) => updateGradient('brandGradient', event.target.value)}
                    className={inputStyle}
                    placeholder={resolved.gradient.brandGradient}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    Hero Gradient
                  </label>
                  <input
                    type="text"
                    value={branding.gradient?.heroGradient ?? ''}
                    onChange={(event) => updateGradient('heroGradient', event.target.value)}
                    className={inputStyle}
                    placeholder={resolved.gradient.heroGradient}
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
