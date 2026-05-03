'use client';

import { useEffect, useState } from 'react';
import { Building2, MapPinned, Network, Route } from 'lucide-react';
import { AttributeTemplate } from '../../attribute-template/types';
import { getTemplateById } from '../service';

interface TemplatePreviewProps {
  templateId: string;
}

export function TemplatePreview({ templateId }: TemplatePreviewProps) {
  const [template, setTemplate] = useState<AttributeTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadTemplate() {
      if (!templateId) {
        setTemplate(null);
        return;
      }

      setLoading(true);
      try {
        const result = await getTemplateById(templateId);
        setTemplate(result);
      } finally {
        setLoading(false);
      }
    }

    void loadTemplate();
  }, [templateId]);

  if (!templateId) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Select an attribute template to preview the assignment hierarchy.
      </div>
    );
  }

  if (loading) {
    return <div className="h-36 animate-pulse rounded-2xl bg-gray-100" />;
  }

  if (!template) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        The selected template could not be loaded.
      </div>
    );
  }

  const cards = [
    { label: 'Streams', count: template.stream.length, icon: Building2 },
    { label: 'Locations', count: template.location.length, icon: MapPinned },
    { label: 'Functions', count: template.function.length, icon: Route },
    { label: 'Departments', count: template.department.length, icon: Network },
  ];

  return (
    <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 via-white to-primary/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-gray-900">{template.name}</h4>
          {template.description && (
            <p className="mt-1 text-sm text-gray-600">{template.description}</p>
          )}
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary shadow-sm">
          Snapshot on Publish
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-white/60 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Icon className="h-4 w-4 text-primary" />
                <span>{card.label}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900">{card.count}</div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-600">
        Templates define the required admin hierarchy used later for assignment validation.
      </p>
    </div>
  );
}
