/**
 * Template Preview Component
 * Shows read-only summary of selected template
 */

'use client';

import { useState, useEffect } from 'react';
import { AttributeTemplate } from '../../attribute-template/types';
import { getTemplateById } from '../service';

interface TemplatePreviewProps {
  templateId: string;
}

export function TemplatePreview({ templateId }: TemplatePreviewProps) {
  const [template, setTemplate] = useState<AttributeTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!templateId) {
        setLoading(false);
        return;
      }
      try {
        const data = await getTemplateById(templateId);
        setTemplate(data);
      } catch (error) {
        console.error('Failed to load template:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
  }, [templateId]);

  if (!templateId) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-500 text-sm">Select a template to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">Template not found</p>
      </div>
    );
  }

  const fieldGroups = [
    { label: 'Streams', items: template.stream },
    { label: 'Locations', items: template.location },
    { label: 'Departments', items: template.department },
    { label: 'Seniority', items: template.seniority },
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-blue-900">{template.name}</h4>
          {template.description && (
            <p className="text-sm text-blue-700 mt-1">{template.description}</p>
          )}
        </div>
        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
          Read Only
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fieldGroups.map((group) => (
          group.items.length > 0 && (
            <div key={group.label}>
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">
                {group.label}
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {group.items.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    className="px-2 py-0.5 bg-white text-blue-800 text-xs rounded border border-blue-200"
                  >
                    {item.label}
                  </span>
                ))}
                {group.items.length > 4 && (
                  <span className="px-2 py-0.5 text-blue-600 text-xs">
                    +{group.items.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-600">
          This template will be used to collect user attributes when they complete this survey.
          Attributes are defined in the template and cannot be modified here.
        </p>
      </div>
    </div>
  );
}
