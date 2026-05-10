'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { AlertTriangle, ImageOff } from 'lucide-react';
import { BrandingConfig } from '@/types';
import {
  DEFAULT_BRANDING,
  getReadableTextColor,
  resolveBrandingConfig,
  validateBrandingConfig,
} from '@/types/branding';
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
        {logoUrl ? <ImageOff className="h-5 w-5" /> : <span className="font-bold">T</span>}
      </div>
    );
  }

  return (
    <div className="h-12 w-12 overflow-hidden rounded-2xl border bg-white shadow-sm">
      <img
        src={logoUrl}
        alt="Tenant branding logo preview"
        className="h-full w-full object-contain"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

function GradientChip({ label, gradient }: { label: string; gradient: string }) {
  return (
    <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-2 h-10 rounded-lg" style={{ background: gradient }} />
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground)' }}>
        {label}
      </p>
      <p className="mt-1 break-all text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
        {gradient}
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
      <div className="h-3 w-full" style={{ background: resolved.gradients.brandGradient }} />

      <div className="space-y-4 p-4">
        <div
          className="rounded-2xl p-4"
          style={{
            background: resolved.gradients.heroGradient,
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
                tenant.remedygcc.com
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: resolved.primaryColor, color: onPrimary }}
            >
              Primary
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                backgroundColor: resolved.secondaryColor,
                borderColor: resolved.primaryColor,
                color: getReadableTextColor(resolved.secondaryColor),
              }}
            >
              Secondary
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <GradientChip label="Brand Gradient" gradient={resolved.gradients.brandGradient} />
          <GradientChip label="Hero Gradient" gradient={resolved.gradients.heroGradient} />
        </div>
      </div>
    </div>
  );
}

export function BrandingPreviewCard({
  branding,
  title = 'Live Preview',
  description = 'Resolved with the same fallback rules expected by the runtime app.',
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
    (key: keyof NonNullable<BrandingConfig['gradients']>, value: string) => {
      onChange((current) => ({
        ...current,
        gradients: {
          ...current.gradients,
          [key]: value,
        },
      }));
    },
    [onChange],
  );

  const handleReset = useCallback(() => {
    onChange({
      appName: DEFAULT_BRANDING.appName,
      logoUrl: DEFAULT_BRANDING.logoUrl,
      primaryColor: DEFAULT_BRANDING.primaryColor,
      secondaryColor: DEFAULT_BRANDING.secondaryColor,
      faviconUrl: DEFAULT_BRANDING.faviconUrl,
      fontFamily: DEFAULT_BRANDING.fontFamily,
      gradients: DEFAULT_BRANDING.gradients,
    });
  }, [onChange]);

  const inputStyle =
    'w-full rounded-lg border border-[var(--input)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]';

  return (
    <div
      className="h-fit w-full rounded-xl border p-5 shadow-sm"
      style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={handleReset}
          className="text-sm transition-colors hover:text-slate-700"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Reset
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
              Branding validation errors
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
                Runtime fallback warnings
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
              App Name
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
              Font Family
            </label>
            <input
              type="text"
              value={branding.fontFamily ?? ''}
              onChange={(event) => updateBrandingField('fontFamily', event.target.value)}
              className={inputStyle}
              placeholder={DEFAULT_BRANDING.fontFamily}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <ImageUploader
              value={branding.logoUrl}
              onChange={(url) => updateBrandingField('logoUrl', url ?? undefined)}
              label="Logo"
              placeholder="Upload runtime logo"
            />
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <ImageUploader
              value={branding.faviconUrl}
              onChange={(url) => updateBrandingField('faviconUrl', url ?? undefined)}
              label="Favicon"
              placeholder="Upload favicon"
              maxSizeMB={2}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <ColorPicker
              value={resolved.primaryColor}
              onChange={(color) => updateBrandingField('primaryColor', color)}
              label="Primary Color"
            />
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
            <ColorPicker
              value={resolved.secondaryColor}
              onChange={(color) => updateBrandingField('secondaryColor', color)}
              label="Secondary Color"
            />
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
        >
          <div className="mb-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Optional Gradient Overrides
            </h4>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Leave empty to let the runtime derive safe gradients automatically.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Brand Gradient
              </label>
              <input
                type="text"
                value={branding.gradients?.brandGradient ?? ''}
                onChange={(event) => updateGradient('brandGradient', event.target.value)}
                className={inputStyle}
                placeholder={resolved.gradients.brandGradient}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Hero Gradient
              </label>
              <input
                type="text"
                value={branding.gradients?.heroGradient ?? ''}
                onChange={(event) => updateGradient('heroGradient', event.target.value)}
                className={inputStyle}
                placeholder={resolved.gradients.heroGradient}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
