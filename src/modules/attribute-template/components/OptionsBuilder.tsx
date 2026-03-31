'use client';

import { useState } from 'react';
import { X, Plus, Tag, ChevronDown } from 'lucide-react';
import { FieldOption, QuestionType, QUESTION_TYPE_OPTIONS } from '../types';

interface OptionsBuilderProps {
  label: string;
  value: FieldOption[];
  onChange: (value: FieldOption[]) => void;
  placeholder?: string;
  readOnly?: boolean;
  showQuestionType?: boolean;
}

export function OptionsBuilder({
  label,
  value,
  onChange,
  placeholder = 'Add option...',
  readOnly = false,
  showQuestionType = true,
}: OptionsBuilderProps) {
  const [newOption, setNewOption] = useState('');

  // Get the first option's questionType or default to dropdown
  const currentQuestionType = value[0]?.questionType || 'dropdown';
  const [questionType, setQuestionType] = useState<QuestionType>(currentQuestionType);

  const handleAdd = () => {
    if (!newOption.trim()) return;
    
    const id = newOption.toLowerCase().replace(/\s+/g, '-');
    const newFieldOption: FieldOption = { 
      id, 
      label: newOption.trim(),
      questionType 
    };
    
    onChange([...value, newFieldOption]);
    setNewOption('');
  };

  const handleRemove = (id: string) => {
    onChange(value.filter(opt => opt.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleQuestionTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    // Update all options with the new questionType
    const updatedOptions = value.map(opt => ({
      ...opt,
      questionType: newType
    }));
    onChange(updatedOptions);
  };

  // Get label for current question type
  const getQuestionTypeLabel = (type: QuestionType) => {
    return QUESTION_TYPE_OPTIONS.find(qt => qt.id === type)?.label || type;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <label className="block text-sm font-semibold text-gray-700">
            {label}
          </label>
          <span className="text-xs text-gray-400">({value.length})</span>
        </div>
        
        {/* Question Type Selector */}
        {showQuestionType && value.length > 0 && !readOnly && (
          <div className="relative">
            <label className="text-xs text-gray-500 mr-2">UI Type:</label>
            <select
              value={questionType}
              onChange={(e) => handleQuestionTypeChange(e.target.value as QuestionType)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {QUESTION_TYPE_OPTIONS.map((qt) => (
                <option key={qt.id} value={qt.id}>
                  {qt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      {/* Question Type Indicator Pills */}
      {showQuestionType && value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            questionType === 'dropdown' ? 'bg-blue-100 text-blue-700' :
            questionType === 'radio' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>
            {getQuestionTypeLabel(questionType)}
          </span>
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 mb-3">
        {value.map((option) => (
          <div
            key={option.id}
            className="flex items-center gap-1.5 bg-primary/5 text-primary border border-primary/20 px-3 py-2 rounded-lg text-sm font-medium group hover:bg-primary/10 transition-colors"
          >
            <span>{option.label}</span>
            {option.questionType && (
              <span className={`text-xs ml-1 ${
                option.questionType === 'dropdown' ? 'text-blue-600' :
                option.questionType === 'radio' ? 'text-purple-600' :
                'text-green-600'
              }`}>
                ({option.questionType === 'buttonRadio' ? 'btn' : option.questionType})
              </span>
            )}
            {!readOnly && (
              <button
                onClick={() => handleRemove(option.id)}
                className="ml-1 hover:text-red-600 transition-colors opacity-60 group-hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        
        {value.length === 0 && (
          <span className="text-sm text-gray-400 italic py-2">
            No options added yet
          </span>
        )}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <button
            onClick={handleAdd}
            disabled={!newOption.trim()}
            className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}
