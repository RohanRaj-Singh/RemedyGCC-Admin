'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

function isValidHSL(color: string): boolean {
  const hslRegex = /^\d+\s+\d+%\s+\d+%( \/\s+\d+%(\.\d+)?)?$/;
  return hslRegex.test(color);
}

function hexToHSL(hex: string): string {
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

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(() => {
    if (isValidHSL(value)) {
      return hslToHex(value);
    }
    return value.startsWith('#') ? value : '#000000';
  });
  const [localHex, setLocalHex] = useState(hexInput);

  useEffect(() => {
    const newHex = isValidHSL(value) ? hslToHex(value) : (value.startsWith('#') ? value : '#000000');
    setHexInput(newHex);
    setLocalHex(newHex);
  }, [value]);

  const commitChange = useCallback((newHex: string) => {
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      const hslValue = hexToHSL(newHex);
      onChange(hslValue);
    }
  }, [onChange]);

  const handleHexInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let newHex = e.target.value;
    if (!newHex.startsWith('#')) {
      newHex = '#' + newHex;
    }
    setLocalHex(newHex);
    
    if (/^#[0-9A-Fa-f]{6}$/.test(newHex)) {
      setHexInput(newHex);
      commitChange(newHex);
    }
  }, [commitChange]);

  const handleHexBlur = useCallback(() => {
    commitChange(localHex);
  }, [localHex, commitChange]);

  const handleHexKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitChange(localHex);
      e.currentTarget.blur();
    }
  }, [localHex, commitChange]);

  const handleNativeColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newHex = e.target.value;
    setLocalHex(newHex);
    setHexInput(newHex);
    commitChange(newHex);
  }, [commitChange]);

  const displayColor = isValidHSL(value) ? `hsl(${value})` : (hexInput || '#000000');
  const luminance = isValidHSL(value) ? parseInt(value.split(' ')[2]) : 50;
  const textColor = luminance > 50 ? '#000' : '#fff';

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
      )}
      
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={hexInput || '#000000'}
            onChange={handleNativeColorChange}
            className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
            aria-label={label || 'Color picker'}
            style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
          <div 
            className="w-10 h-10 rounded-lg pointer-events-none border flex items-center justify-center"
            style={{ 
              backgroundColor: displayColor,
              borderColor: 'var(--border)'
            }}
          >
            <svg className="w-4 h-4" style={{ color: textColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={localHex}
            onChange={handleHexInput}
            onBlur={handleHexBlur}
            onKeyDown={handleHexKeyDown}
            placeholder="#000000"
            className={cn(
              "w-full px-3 py-2 rounded-lg border text-sm font-mono",
              "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)]",
              "border-[var(--input)]"
            )}
            style={{ 
              color: 'var(--foreground)',
              backgroundColor: 'var(--background)'
            }}
            aria-label="Hex color value"
          />
        </div>
      </div>

      <div 
        className="h-6 rounded-md border flex items-center px-2 transition-colors duration-150"
        style={{ 
          backgroundColor: displayColor,
          borderColor: 'var(--border)'
        }}
      >
        <span 
          className="text-xs font-medium font-mono"
          style={{ color: textColor }}
        >
          {isValidHSL(value) ? `hsl(${value})` : value}
        </span>
      </div>
    </div>
  );
}
