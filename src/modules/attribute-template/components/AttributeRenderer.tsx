/**
 * Attribute Renderer Component
 * Renders attribute fields based on their questionType
 */

'use client';

import { useState } from 'react';
import { FieldOption, QuestionType } from '../types';
import { cn } from '@/lib/utils';

interface AttributeRendererProps {
  label: string;
  options: FieldOption[];
  questionType: QuestionType;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Dropdown Renderer
function DropdownRenderer({ label, options, value, onChange, disabled }: Omit<AttributeRendererProps, 'questionType'>) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      >
        <option value="">Select {label.toLowerCase()}...</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Radio Renderer
function RadioRenderer({ label, options, value, onChange, disabled }: Omit<AttributeRendererProps, 'questionType'>) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
              value === option.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <input
              type="radio"
              name={label}
              value={option.id}
              checked={value === option.id}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Button Radio Renderer
function ButtonRadioRenderer({ label, options, value, onChange, disabled }: Omit<AttributeRendererProps, 'questionType'>) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              value === option.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Main Renderer Component
export function AttributeRenderer({
  label,
  options,
  questionType,
  value,
  onChange,
  disabled = false,
}: AttributeRendererProps) {
  switch (questionType) {
    case 'dropdown':
      return (
        <DropdownRenderer
          label={label}
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'radio':
      return (
        <RadioRenderer
          label={label}
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'buttonRadio':
      return (
        <ButtonRadioRenderer
          label={label}
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    default:
      // Default to dropdown
      return (
        <DropdownRenderer
          label={label}
          options={options}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
  }
}

// Prompt Component for Super Admin to choose design
interface AttributePromptProps {
  fieldType: string;
  currentType: QuestionType;
  onSave: (questionType: QuestionType) => void;
}

export function AttributePrompt({ fieldType, currentType, onSave }: AttributePromptProps) {
  const [selectedType, setSelectedType] = useState<QuestionType>(currentType || 'dropdown');

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-2">Choose UI for {fieldType}</h4>
      <p className="text-sm text-gray-500 mb-4">
        How should users select their {fieldType}? Select the design that best fits your form.
      </p>
      
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['dropdown', 'radio', 'buttonRadio'] as QuestionType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={cn(
              "p-3 rounded-lg border-2 text-left transition-all",
              selectedType === type
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="font-medium text-sm text-gray-900 capitalize">
              {type === 'buttonRadio' ? 'Button Radio' : type}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {type === 'dropdown' && 'Dropdown menu'}
              {type === 'radio' && 'Radio buttons'}
              {type === 'buttonRadio' && 'Button options'}
            </div>
          </button>
        ))}
      </div>

      {/* Preview */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500 mb-2">Preview:</p>
        {selectedType === 'dropdown' && (
          <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option>Sample dropdown</option>
          </select>
        )}
        {selectedType === 'radio' && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="preview" /> Option 1
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="preview" /> Option 2
            </label>
          </div>
        )}
        {selectedType === 'buttonRadio' && (
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-gray-200 rounded-full text-xs">Option 1</button>
            <button className="px-3 py-1 bg-gray-200 rounded-full text-xs">Option 2</button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={() => onSave(selectedType)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          Save Selection
        </button>
      </div>
    </div>
  );
}
