'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Loader2, Info, Settings, Lock, Lightbulb, BookOpen } from 'lucide-react';
import { OptionsBuilder } from '@/modules/attribute-template/components/OptionsBuilder';
import { DepartmentMappingInput } from '@/modules/attribute-template/components/DepartmentMappingInput';
import { FunctionMappingInput } from '@/modules/attribute-template/components/FunctionMappingInput';
import {
  CreateAttributeTemplateDto,
  FieldOption,
  DepartmentOption,
  FunctionOption,
  GENDER_OPTIONS,
  AGE_RANGES,
} from '@/modules/attribute-template/types';
import { createTemplate } from '@/modules/attribute-template/service';

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('attribute-templates');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stream, setStream] = useState<FieldOption[]>([]);
  const [location, setLocation] = useState<FieldOption[]>([]);
  const [functionField, setFunctionField] = useState<FunctionOption[]>([]);
  const [department, setDepartment] = useState<DepartmentOption[]>([]);
  const [seniority, setSeniority] = useState<FieldOption[]>([]);

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

      await createTemplate(templateData);
      router.push('/attribute-templates');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'dashboard') router.push('/');
    else if (tab === 'tenants') router.push('/');
    else if (tab === 'scanners') router.push('/');
    else if (tab === 'logs') router.push('/');
    else if (tab === 'settings') router.push('/');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-roca)]">
          Create Attribute Template
        </h1>
        <p className="text-gray-500 mt-1">Define custom attributes for your scanner</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Main Form */}
        <div className="xl:col-span-2 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Basic Info Section */}
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-base bg-gray-50/50"
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-base resize-none bg-gray-50/50"
                />
              </div>
            </div>
          </div>

          {/* Editable Fields Section */}
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

          {/* Fixed Fields Section */}
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-100">
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
                  Create Template
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Help Panel */}
        <div className="space-y-6">
          {/* Quick Tips */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                Quick Tips
              </h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Add at least 3-5 streams to give users good options</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Map departments to streams for better filtering</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Keep location options relevant to your organization</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Seniority levels help segment your data analysis</span>
              </li>
            </ul>
          </div>

          {/* Field Guide */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)]">
                Field Guide
              </h3>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Streams</h4>
                <p className="text-gray-500">High-level categories like Technology, Finance, Marketing</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Departments</h4>
                <p className="text-gray-500">Specific teams within each stream (linked to stream)</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Functions</h4>
                <p className="text-gray-500">Roles like Engineering, Sales, Support</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Locations</h4>
                <p className="text-gray-500">Geographic regions or office locations</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Seniority</h4>
                <p className="text-gray-500">Career levels from Intern to CXO</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 font-[family-name:var(--font-roca)] mb-4">
              Template Preview
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Streams</span>
                <span className="font-medium text-gray-900">{stream.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Departments</span>
                <span className="font-medium text-gray-900">{department.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Locations</span>
                <span className="font-medium text-gray-900">{location.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Functions</span>
                <span className="font-medium text-gray-900">{functionField.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Seniority</span>
                <span className="font-medium text-gray-900">{seniority.length}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Fixed Fields</span>
                <span className="font-medium text-gray-900">2</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
