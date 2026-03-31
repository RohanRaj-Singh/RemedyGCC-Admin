/**
 * Scanner Form Component
 * Main form for creating/editing scanners
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Question, CreateScannerDto, Scanner } from '../types';
import { createScanner, updateScanner } from '../service';
import { validateWeights } from '../utils/weightUtils';
import { TemplateSelector } from './TemplateSelector';
import { TemplatePreview } from './TemplatePreview';
import { QuestionList } from './QuestionBuilder/QuestionList';

interface ScannerFormProps {
  scanner?: Scanner; // If provided, we're editing
}

export function ScannerForm({ scanner }: ScannerFormProps) {
  const router = useRouter();
  const isEditing = !!scanner;

  // Form state
  const [name, setName] = useState(scanner?.name || '');
  const [description, setDescription] = useState(scanner?.description || '');
  const [templateId, setTemplateId] = useState(scanner?.templateId || '');
  const [questions, setQuestions] = useState<Question[]>(scanner?.questions || []);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = validateWeights(questions);
  const canPublish = validation.isValid && name.trim() && templateId && questions.length > 0;

  const handleSubmit = async (publish: boolean = false) => {
    if (!name.trim()) {
      setError('Please enter a scanner name');
      return;
    }
    if (!templateId) {
      setError('Please select a template');
      return;
    }
    if (questions.length === 0) {
      setError('Please add at least one question');
      return;
    }
    if (!validation.isValid) {
      setError('Total weight must equal 100 before publishing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scannerData = {
        name: name.trim(),
        description: description.trim() || undefined,
        templateId,
        questions: questions.map(({ text, options, weight }) => ({
          text,
          options,
          weight,
        })),
      };

      if (isEditing && scanner) {
        await updateScanner(scanner.id, {
          ...scannerData,
          status: publish ? 'published' : 'draft',
        });
      } else {
        await createScanner(scannerData);
      }

      router.push('/scanners');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save scanner');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* SECTION A - Basic Info */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scanner Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Employee Satisfaction Survey"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this survey..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </section>

      {/* SECTION B - Template Selector */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Attribute Template</h2>
        
        <div className="space-y-4">
          <TemplateSelector
            selectedTemplateId={templateId}
            onSelect={setTemplateId}
          />

          {templateId && (
            <div className="mt-4">
              <TemplatePreview templateId={templateId} />
            </div>
          )}
        </div>
      </section>

      {/* SECTION C - Question Builder */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Questions</h2>
        
        <QuestionList
          questions={questions}
          onQuestionsChange={setQuestions}
        />
      </section>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push('/scanners')}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={loading || !canPublish}
          className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            'Publishing...'
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Publish Scanner
            </>
          )}
        </button>
      </div>

      {/* Validation hint */}
      {!canPublish && questions.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          {!validation.isValid && (
            <span>Total weight must equal 100 to publish</span>
          )}
          {validation.isValid && !name.trim() && (
            <span>Enter a scanner name to publish</span>
          )}
        </div>
      )}
    </div>
  );
}
