'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  ChevronRight,
  LayoutTemplate,
  Loader2
} from 'lucide-react';
import { AttributeTemplate } from '../types';
import { getAllTemplates, deleteTemplate } from '../service';

export function TemplateList() {
  const [templates, setTemplates] = useState<AttributeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span>Super Admin</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-primary font-medium">Attribute Templates</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-roca)]">
              Attribute Templates
            </h1>
            <p className="text-gray-500 mt-1">
              Manage linked attribute templates for scanner assignment rules
            </p>
          </div>
          
          <Link
            href="/attribute-templates/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{templates.length}</div>
            <div className="text-sm text-gray-500">Total Templates</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{templates.reduce((acc, t) => acc + t.stream.length, 0)}</div>
            <div className="text-sm text-gray-500">Total Streams</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{templates.reduce((acc, t) => acc + t.function.length, 0)}</div>
            <div className="text-sm text-gray-500">Total Functions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{templates.reduce((acc, t) => acc + t.location.length, 0)}</div>
            <div className="text-sm text-gray-500">Total Locations</div>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <LayoutTemplate className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No templates yet
          </h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Create your first attribute template to get started with managing user attributes for your scanners
          </p>
          <Link
            href="/attribute-templates/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-gray-100 p-6 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <LayoutTemplate className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                      {template.name}
                    </h3>
                  </div>
                  
                  {template.description && (
                    <p className="text-gray-500 text-sm mb-4">
                      {template.description}
                    </p>
                  )}

                  {/* Field counts */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium">{template.stream.length}</span>
                      <span>Streams</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium">{template.location.length}</span>
                      <span>Locations</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium">{template.function.length}</span>
                      <span>Functions</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium">{template.department.length}</span>
                      <span>Departments</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <span className="font-medium">{template.seniority.length}</span>
                      <span>Seniority Levels</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-4 bg-gray-50 rounded-lg p-1">
                  <Link
                    href={`/attribute-templates/${template.id}/edit`}
                    className="p-2 text-gray-500 hover:text-primary hover:bg-white rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    disabled={deletingId === template.id}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-md transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Created {formatDate(template.createdAt)}</span>
                </div>
                {template.updatedAt !== template.createdAt && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span>Updated {formatDate(template.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
