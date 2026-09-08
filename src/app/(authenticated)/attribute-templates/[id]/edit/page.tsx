'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TemplateForm } from '@/modules/attribute-template/components';
import { getTemplateById } from '@/modules/attribute-template/service';
import { AttributeTemplate } from '@/modules/attribute-template/types';

interface EditTemplatePageProps {
  params: { id: string };
}

export default function EditTemplatePage({ params }: EditTemplatePageProps) {
  const [template, setTemplate] = useState<AttributeTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplate() {
      const result = await getTemplateById(params.id);
      if (!result) {
        notFound();
        return;
      }

      setTemplate(result);
      setLoading(false);
    }

    void loadTemplate();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-roca)] text-2xl font-bold text-gray-900">
          Edit Attribute Template
        </h1>
        <p className="mt-1 text-gray-500">
          Update linked hierarchy for {template.name}
        </p>
      </div>

      <TemplateForm template={template} />
    </div>
  );
}
