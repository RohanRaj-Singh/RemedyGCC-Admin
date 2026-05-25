'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { TenantContentConfig } from '@/types/content';

interface TenantContentPanelProps {
  content: TenantContentConfig;
  onChange: Dispatch<SetStateAction<TenantContentConfig>>;
  title?: string;
  description?: string;
}

export function TenantContentPanel({
  content,
  onChange,
  title = 'Subdomain Content',
  description = 'Manage page-specific copy for this tenant. Additional content blocks can be added here over time.',
}: TenantContentPanelProps) {
  const aboutIntro = content.pages?.about?.intro?.en ?? '';

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: 'hsl(0 0% 98%)', borderColor: 'var(--border)' }}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}
      >
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          About Us Intro
        </label>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          This text replaces the main intro line on the tenant About page. For now, this editor sets the English copy and falls back to the app default when left empty.
        </p>
        <textarea
          value={aboutIntro}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              pages: {
                ...(current.pages ?? {}),
                about: {
                  ...(current.pages?.about ?? {}),
                  intro: {
                    ...(current.pages?.about?.intro ?? {}),
                    en: event.target.value,
                  },
                },
              },
            }))
          }
          rows={4}
          className="mt-3 w-full rounded-lg border border-[var(--input)] px-3 py-2 text-sm focus:border-[var(--ring)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          placeholder="Our wellbeing platform helps organizations understand and improve employee experience through data-driven insights."
        />
      </div>
    </div>
  );
}
