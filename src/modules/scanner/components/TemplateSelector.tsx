/**
 * Template Selector Component
 * Dropdown for selecting an attribute template
 */

'use client';

import { useState, useEffect } from 'react';
import { TemplateOption } from '../types';
import { getTemplates } from '../service';

interface TemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
}

export function TemplateSelector({ selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const data = await getTemplates();
        setTemplates(data);
        // Auto-select first template if none selected
        if (!selectedTemplateId && data.length > 0) {
          onSelect(data[0].id);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Attribute Template
      </label>
      <select
        value={selectedTemplateId || ''}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <option value="" disabled>Select a template...</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.fieldCount} fields)
          </option>
        ))}
      </select>
      <p className="mt-1 text-sm text-gray-500">
        The template defines which user attributes will be collected
      </p>
    </div>
  );
}
