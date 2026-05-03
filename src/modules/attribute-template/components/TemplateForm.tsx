'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Info, Lightbulb, Loader2, Lock, Save, Settings } from 'lucide-react';
import { DepartmentMappingInput } from './DepartmentMappingInput';
import { FunctionMappingInput } from './FunctionMappingInput';
import { LocationMappingInput } from './LocationMappingInput';
import { OptionsBuilder } from './OptionsBuilder';
import {
  AGE_RANGES,
  AttributeTemplate,
  CreateAttributeTemplateDto,
  DepartmentOption,
  FieldOption,
  FunctionOption,
  GENDER_OPTIONS,
  LocationOption,
} from '../types';
import { createTemplate, updateTemplate } from '../service';

interface TemplateFormProps {
  template?: AttributeTemplate;
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter();
  const isEditing = Boolean(template);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [stream, setStream] = useState<FieldOption[]>(template?.stream || []);
  const [location, setLocation] = useState<LocationOption[]>(template?.location || []);
  const [functionField, setFunctionField] = useState<FunctionOption[]>(template?.function || []);
  const [department, setDepartment] = useState<DepartmentOption[]>(template?.department || []);
  const [seniority, setSeniority] = useState<FieldOption[]>(template?.seniority || []);

  function handleStreamsChange(nextStreams: FieldOption[]) {
    const streamIds = new Set(nextStreams.map((item) => item.id));
    const nextLocations = location.filter((item) => streamIds.has(item.streamId));
    const locationIds = new Set(nextLocations.map((item) => item.id));
    const nextFunctions = functionField.filter((item) => locationIds.has(item.locationId));
    const functionIds = new Set(nextFunctions.map((item) => item.id));

    setStream(nextStreams);
    setLocation(nextLocations);
    setFunctionField(nextFunctions);
    setDepartment(department.filter((item) => functionIds.has(item.functionId)));
  }

  function handleLocationsChange(nextLocations: LocationOption[]) {
    const locationIds = new Set(nextLocations.map((item) => item.id));
    const nextFunctions = functionField.filter((item) => locationIds.has(item.locationId));
    const functionIds = new Set(nextFunctions.map((item) => item.id));

    setLocation(nextLocations);
    setFunctionField(nextFunctions);
    setDepartment(department.filter((item) => functionIds.has(item.functionId)));
  }

  function handleFunctionsChange(nextFunctions: FunctionOption[]) {
    const functionIds = new Set(nextFunctions.map((item) => item.id));
    setFunctionField(nextFunctions);
    setDepartment(department.filter((item) => functionIds.has(item.functionId)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (stream.length === 0) {
      setError('At least one stream is required');
      return;
    }

    if (location.length === 0) {
      setError('At least one linked location is required');
      return;
    }

    if (functionField.length === 0) {
      setError('At least one linked function is required');
      return;
    }

    if (department.length === 0) {
      setError('At least one linked department is required');
      return;
    }

    setLoading(true);

    try {
      const payload: CreateAttributeTemplateDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        stream,
        location,
        function: functionField,
        department,
        seniority,
      };

      if (isEditing && template) {
        await updateTemplate({ id: template.id, ...payload });
      } else {
        await createTemplate(payload);
      }

      router.push('/attribute-templates');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save template');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
                  Basic Information
                </h3>
                <p className="text-sm text-gray-500">Define your template details</p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g., Corporate Template"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional description for this template..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
                  Linked Hierarchy
                </h3>
                <p className="text-sm text-gray-500">
                  Build the required stream to location to function to department chain.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6">
            <OptionsBuilder
              label="Streams"
              value={stream}
              onChange={handleStreamsChange}
              placeholder="e.g., Technology"
            />

            <LocationMappingInput
              streams={stream}
              locations={location}
              onChange={handleLocationsChange}
            />

            <FunctionMappingInput
              locations={location}
              functions={functionField}
              onChange={handleFunctionsChange}
            />

            <DepartmentMappingInput
              functions={functionField}
              departments={department}
              onChange={setDepartment}
            />

            <OptionsBuilder
              label="Seniority Levels"
              value={seniority}
              onChange={setSeniority}
              placeholder="e.g., Senior"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 bg-gradient-to-r from-gray-50 to-transparent px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
                  Fixed Fields
                </h3>
                <p className="text-sm text-gray-500">Predefined attributes (cannot be modified)</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-2">
            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Gender
              </label>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <span key={option.id} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
                    {option.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Age Ranges
              </label>
              <div className="flex flex-wrap gap-2">
                {AGE_RANGES.map((option) => (
                  <span key={option.id} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
                    {option.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-semibold text-white transition hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {isEditing ? 'Update Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
              Quick Tips
            </h3>
          </div>
          <ul className="space-y-3 text-sm text-gray-600">
            <li>Keep streams broad and stable across scanner methodologies.</li>
            <li>Each location must sit under one stream only.</li>
            <li>Each function must sit under one location only.</li>
            <li>Each department must sit under one function only.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <BookOpen className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
              Hierarchy Guide
            </h3>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <h4 className="mb-1 font-semibold text-gray-700">Streams</h4>
              <p className="text-gray-500">Top-level workforce tracks like Technology or Finance.</p>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-gray-700">Locations</h4>
              <p className="text-gray-500">Location choices that belong to one stream.</p>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-gray-700">Functions</h4>
              <p className="text-gray-500">Function choices that belong to one location.</p>
            </div>
            <div>
              <h4 className="mb-1 font-semibold text-gray-700">Departments</h4>
              <p className="text-gray-500">Departments that belong to one function.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-[family-name:var(--font-roca)] text-lg font-semibold text-gray-900">
            Template Preview
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Streams</span>
              <span className="font-medium text-gray-900">{stream.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Locations</span>
              <span className="font-medium text-gray-900">{location.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Functions</span>
              <span className="font-medium text-gray-900">{functionField.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
              <span className="text-gray-500">Departments</span>
              <span className="font-medium text-gray-900">{department.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-100 py-2">
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
  );
}
