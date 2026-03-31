'use client';

import { useState } from 'react';
import { BrandingConfig, ColorScheme, BrandingAssets } from '@/types';
import { DEFAULT_BRANDING } from '@/types/branding';
import { X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandingEditorProps {
  branding: BrandingConfig;
  onSave: (branding: Partial<BrandingConfig>) => Promise<void>;
  onCancel: () => void;
}

export function BrandingEditor({ branding, onSave, onCancel }: BrandingEditorProps) {
  const [localBranding, setLocalBranding] = useState<BrandingConfig>(branding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleColorChange = (key: keyof ColorScheme, value: string) => {
    setLocalBranding(prev => ({
      ...prev,
      colorScheme: {
        ...prev.colorScheme,
        [key]: value,
      },
    }));
  };

  const handleLogoUrlChange = (value: string) => {
    setLocalBranding(prev => ({
      ...prev,
      logoUrl: value,
    }));
  };

  const handleFontChange = (value: string) => {
    setLocalBranding(prev => ({
      ...prev,
      fontFamily: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(localBranding);
    } catch (err) {
      setError('Failed to save branding');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setLocalBranding(DEFAULT_BRANDING);
  };

  const labelStyle = 'block text-sm font-medium mb-1';
  const inputStyle = 'w-full px-3 py-2 rounded-lg border border-[var(--input)] focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] outline-none transition-all';
  const buttonStyle = 'px-4 py-2 rounded-lg font-medium transition-colors';

  const fontOptions = [
    'Satoshi, Inter, sans-serif',
    'Roboto, sans-serif',
    'Open Sans, sans-serif',
    'Montserrat, sans-serif',
    'Poppins, sans-serif',
    'Inter, sans-serif',
    'Lato, sans-serif',
    'Nunito, sans-serif',
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div 
          className="p-4 rounded-lg border text-sm"
          style={{ 
            backgroundColor: 'hsl(0 84% 60% / 0.1)', 
            borderColor: 'var(--destructive)', 
            color: 'var(--destructive)' 
          }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className={labelStyle} style={{ color: 'var(--foreground)' }}>Logo URL</label>
          <input
            type="url"
            value={localBranding.logoUrl}
            onChange={(e) => handleLogoUrlChange(e.target.value)}
            className={inputStyle}
            placeholder="/logos/tenant.svg"
          />
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Path to the tenant's logo image
          </p>
        </div>

        <div className="space-y-2">
          <label className={labelStyle} style={{ color: 'var(--foreground)' }}>Font Family</label>
          <select
            value={localBranding.fontFamily || 'Satoshi, Inter, sans-serif'}
            onChange={(e) => handleFontChange(e.target.value)}
            className={inputStyle}
          >
            {fontOptions.map(font => (
              <option key={font} value={font}>{font.split(',')[0]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <label className={labelStyle} style={{ color: 'var(--foreground)' }}>Color Scheme</label>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Primary</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(localBranding.colorScheme.primaryColor)}
                onChange={(e) => handleColorChange('primaryColor', hexToHsl(e.target.value))}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.colorScheme.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border"
                placeholder="156 63% 16%"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Secondary</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(localBranding.colorScheme.secondaryColor || '0 0% 96%')}
                onChange={(e) => handleColorChange('secondaryColor', hexToHsl(e.target.value))}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.colorScheme.secondaryColor || '0 0% 96%'}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(localBranding.colorScheme.backgroundColor || '0 0% 100%')}
                onChange={(e) => handleColorChange('backgroundColor', hexToHsl(e.target.value))}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.colorScheme.backgroundColor || '0 0% 100%'}
                onChange={(e) => handleColorChange('backgroundColor', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Text</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(localBranding.colorScheme.textColor || '0 0% 43%')}
                onChange={(e) => handleColorChange('textColor', hexToHsl(e.target.value))}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.colorScheme.textColor || '0 0% 43%'}
                onChange={(e) => handleColorChange('textColor', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslToHex(localBranding.colorScheme.accentColor || '212 100% 50%')}
                onChange={(e) => handleColorChange('accentColor', hexToHsl(e.target.value))}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={localBranding.colorScheme.accentColor || '212 100% 50%'}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="flex-1 px-2 py-1 text-xs rounded border"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg border" style={{ backgroundColor: localBranding.colorScheme.backgroundColor || '#fff' }}>
        <p className="text-xs mb-2" style={{ color: localBranding.colorScheme.textColor || '#333' }}>Preview</p>
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: localBranding.colorScheme.primaryColor }}
          >
            <span className="font-bold text-white">T</span>
          </div>
          <div>
            <p className="font-semibold" style={{ color: localBranding.colorScheme.textColor || '#333' }}>Tenant Name</p>
            <p className="text-sm" style={{ color: localBranding.colorScheme.textColor || '#333', opacity: 0.7 }}>tenant.remedygcc.com</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            className="px-4 py-2 rounded-lg font-medium text-white"
            style={{ backgroundColor: localBranding.colorScheme.primaryColor }}
          >
            Primary Button
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium border"
            style={{ 
              borderColor: localBranding.colorScheme.primaryColor,
              color: localBranding.colorScheme.primaryColor
            }}
          >
            Secondary Button
          </button>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={handleReset}
          className={buttonStyle}
          style={{ 
            border: '1px solid var(--border)', 
            color: 'var(--muted-foreground)',
            backgroundColor: 'transparent'
          }}
        >
          Reset to Default
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={buttonStyle}
            style={{ 
              border: '1px solid var(--border)', 
              color: 'var(--foreground)',
              backgroundColor: 'transparent'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={buttonStyle}
            style={{ 
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Save Branding
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function hslToHex(hsl: string): string {
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return '#000000';
  
  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 0%';

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}