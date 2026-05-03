import { TemplateForm } from '@/modules/attribute-template/components';

export default function NewTemplatePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-roca)] text-2xl font-bold text-gray-900">
          Create Attribute Template
        </h1>
        <p className="mt-1 text-gray-500">
          Define the linked assignment hierarchy used by scanners.
        </p>
      </div>

      <TemplateForm />
    </div>
  );
}
