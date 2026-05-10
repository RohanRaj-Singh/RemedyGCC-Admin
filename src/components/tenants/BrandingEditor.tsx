'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { BrandingConfig } from '@/types';
import { BrandingPanel } from './BrandingPanel';

interface BrandingEditorProps {
  branding: BrandingConfig;
  onSave: (branding: Partial<BrandingConfig>) => Promise<void>;
  onCancel: () => void;
}

export function BrandingEditor({ branding, onSave, onCancel }: BrandingEditorProps) {
  const [localBranding, setLocalBranding] = useState<Partial<BrandingConfig>>(branding);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(localBranding);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: 'hsl(0 84% 60% / 0.1)',
            borderColor: 'var(--destructive)',
            color: 'var(--destructive)',
          }}
        >
          {error}
        </div>
      )}

      <BrandingPanel
        branding={localBranding}
        onChange={setLocalBranding}
        title="Runtime Branding"
        showPreviewSection={true}
      />

      <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border px-4 py-2 font-medium transition-colors"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
            backgroundColor: 'transparent',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-4 py-2 font-medium transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-foreground)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Save Branding
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
