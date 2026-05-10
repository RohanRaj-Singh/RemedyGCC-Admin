'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { isValidHexColor, normalizeHexColor } from '@/types/branding';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const normalized = normalizeHexColor(value, '#000000');
  const [localHex, setLocalHex] = useState(normalized);

  useEffect(() => {
    setLocalHex(normalized);
  }, [normalized]);

  const commitChange = useCallback(
    (nextHex: string) => {
      if (isValidHexColor(nextHex)) {
        onChange(normalizeHexColor(nextHex, '#000000'));
      }
    },
    [onChange],
  );

  const handleHexInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    let nextHex = event.target.value.trim();
    if (!nextHex.startsWith('#')) {
      nextHex = `#${nextHex}`;
    }

    setLocalHex(nextHex);
    if (isValidHexColor(nextHex)) {
      commitChange(nextHex);
    }
  }, [commitChange]);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {label}
        </label>
      )}

      <div className="flex items-center gap-3">
        <input
          type="color"
          value={normalized}
          onChange={(event) => commitChange(event.target.value)}
          className="h-10 w-10 rounded-lg border-0 bg-transparent p-0"
          aria-label={label || 'Color picker'}
        />

        <input
          type="text"
          value={localHex}
          onChange={handleHexInput}
          onBlur={() => commitChange(localHex)}
          placeholder="#000000"
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-sm font-mono',
            'border-[var(--input)] focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
          )}
          style={{
            color: 'var(--foreground)',
            backgroundColor: 'var(--background)',
          }}
          aria-label="Hex color value"
        />
      </div>

      <div
        className="h-6 rounded-md border"
        style={{
          backgroundColor: normalized,
          borderColor: 'var(--border)',
        }}
      />
    </div>
  );
}
