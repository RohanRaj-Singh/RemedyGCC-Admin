'use client';

import { useEffect, useState } from 'react';
import { TemplateOption } from '../types';
import { getTemplates } from '../service';

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await getTemplates();
        setTemplates(data);

        if (!selectedTemplateId && data.length > 0) {
          onSelect(data[0].id);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadTemplates();
  }, [onSelect, selectedTemplateId]);

  if (loading) {
    return <div className="h-11 animate-pulse rounded-xl bg-gray-100" />;
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        Attribute Template
      </label>
      <select
        value={selectedTemplateId}
        onChange={(event) => onSelect(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
      >
        <option value="" disabled>
          Select a template...
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.streamCount} streams, {template.departmentCount} departments)
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        A published scanner freezes a snapshot of the selected attribute template.
      </p>
    </div>
  );
}
