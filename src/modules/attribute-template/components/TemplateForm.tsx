'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Loader2, Info, Settings, Lock } from 'lucide-react';
import { OptionsBuilder } from './OptionsBuilder';
import { DepartmentMappingInput } from './DepartmentMappingInput';
import { FunctionMappingInput } from './FunctionMappingInput';
import {
  AttributeTemplate,
  CreateAttributeTemplateDto,
  FieldOption,
  DepartmentOption,
  FunctionOption,
  GENDER_OPTIONS,
  AGE_RANGES,
} from '../types';
import { createTemplate, updateTemplate } from '../service';

interface TemplateFormProps {
  template?: AttributeTemplate;
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const isEditing = !!template;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [stream, setStream] = useState<FieldOption[]>(template?.stream || []);
  const [location, setLocation] = useState<FieldOption[]>(template?.location || []);
  const [functionField, setFunctionField] = useState<FunctionOption[]>(template?.function || []);
  const [department, setDepartment] = useState<DepartmentOption[]>(template?.department || []);
  const [seniority, setSeniority] = useState<FieldOption[]>(template?.seniority || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (stream.length === 0) {
      setError('At least one stream is required');
      return;
    }

    if (department.length === 0) {
      setError('At least one department mapping is required');
      return;
    }

    if (functionField.length === 0) {
      setError('At least one function mapping is required');
      return;
    }

    setLoading(true);

    try {
      const templateData: CreateAttributeTemplateDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        stream,
        location,
        function: functionField,
        department,
        seniority,
      };

      if (isEditing && template) {
        await updateTemplate({ id: template.id, ...templateData });
      } else {
        await createTemplate(templateData);
      }

      router.push('/attribute-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Basic Info Section - Enhanced Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                Basic Information
              </h3>
              <p className="text-sm text-gray-500">Define your template details</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Corporate Template"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-base bg-gray-50/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for this template..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-base resize-none bg-gray-50/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Editable Fields Section - Enhanced Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 to-transparent px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                Editable Fields
              </h3>
              <p className="text-sm text-gray-500">Customize your attribute options</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 grid gap-8">
          <OptionsBuilder
            label="Streams"
            value={stream}
            onChange={setStream}
            placeholder="e.g., Technology"
          />

          <div className="grid md:grid-cols-2 gap-6">
            <OptionsBuilder
              label="Locations"
              value={location}
              onChange={setLocation}
              placeholder="e.g., United States"
            />
          </div>

          <DepartmentMappingInput
            streams={stream}
            departments={department}
            onChange={setDepartment}
          />

          <FunctionMappingInput
            departments={department}
            functions={functionField}
            onChange={setFunctionField}
          />

          <OptionsBuilder
            label="Seniority Levels"
            value={seniority}
            onChange={setSeniority}
            placeholder="e.g., Senior"
          />
        </div>
      </div>

      {/* Fixed Fields Section - Enhanced Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-transparent px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                Fixed Fields
              </h3>
              <p className="text-sm text-gray-500">Predefined attributes (cannot be modified)</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 grid md:grid-cols-2 gap-8">
          {/* Gender - Fixed */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Gender
            </label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => (
                <span
                  key={option.id}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium shadow-sm"
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>

          {/* Age - Fixed */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Age Ranges
            </label>
            <div className="flex flex-wrap gap-2">
              {AGE_RANGES.map((option) => (
                <span
                  key={option.id}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium shadow-sm"
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Enhanced */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEditing ? 'Update Template' : 'Create Template'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
