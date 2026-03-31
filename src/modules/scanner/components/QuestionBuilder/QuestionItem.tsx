/**
 * Question Item Component
 * Single question with editable text, options, and weight
 */

'use client';

import { Question } from '../../types';
import { WeightInput } from './WeightInput';

interface QuestionItemProps {
  question: Question;
  index: number;
  onUpdate: (question: Question) => void;
  onDelete: (id: string) => void;
}

export function QuestionItem({ question, index, onUpdate, onDelete }: QuestionItemProps) {
  const handleTextChange = (text: string) => {
    onUpdate({ ...question, text });
  };

  const handleOptionsChange = (options: string[]) => {
    onUpdate({ ...question, options });
  };

  const handleWeightChange = (weight: number) => {
    onUpdate({ ...question, weight });
  };

  const addOption = () => {
    onUpdate({ 
      ...question, 
      options: [...question.options, `Option ${question.options.length + 1}`] 
    });
  };

  const removeOption = (optionIndex: number) => {
    if (question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      onUpdate({ ...question, options: newOptions });
    }
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...question.options];
    newOptions[optionIndex] = value;
    onUpdate({ ...question, options: newOptions });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
            {index + 1}
          </span>
          <span className="text-sm text-gray-500">Question</span>
        </div>
        <button
          onClick={() => onDelete(question.id)}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete question"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Question Text */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Question Text
        </label>
        <input
          type="text"
          value={question.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Enter your question..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Options */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Answer Options
        </label>
        <div className="space-y-2">
          {question.options.map((option, optIndex) => (
            <div key={optIndex} className="flex items-center gap-2">
              <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-500 text-xs rounded">
                {optIndex + 1}
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => updateOption(optIndex, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              {question.options.length > 2 && (
                <button
                  onClick={() => removeOption(optIndex)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addOption}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Option
        </button>
      </div>

      {/* Weight */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-700">Weight</span>
        <WeightInput value={question.weight} onChange={handleWeightChange} />
      </div>
    </div>
  );
}
