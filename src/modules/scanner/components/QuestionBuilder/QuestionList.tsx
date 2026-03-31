/**
 * Question List Component
 * Manages list of questions with add/remove functionality
 */

'use client';

import { Question, WeightValidation } from '../../types';
import { QuestionItem } from './QuestionItem';
import { WeightSummary } from './WeightSummary';
import { createNewQuestion, distributeEqually, validateWeights } from '../../utils/weightUtils';

interface QuestionListProps {
  questions: Question[];
  onQuestionsChange: (questions: Question[]) => void;
}

export function QuestionList({ questions, onQuestionsChange }: QuestionListProps) {
  const validation = validateWeights(questions);

  const handleAddQuestion = () => {
    const newQuestion = createNewQuestion(questions);
    onQuestionsChange([...questions, newQuestion]);
  };

  const handleUpdateQuestion = (updatedQuestion: Question) => {
    const newQuestions = questions.map(q => 
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    onQuestionsChange(newQuestions);
  };

  const handleDeleteQuestion = (id: string) => {
    const newQuestions = questions.filter(q => q.id !== id);
    onQuestionsChange(newQuestions);
  };

  const handleDistributeEqually = () => {
    const distributed = distributeEqually(questions);
    onQuestionsChange(distributed);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Questions Column */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Questions ({questions.length})
          </h3>
          <div className="flex gap-2">
            {questions.length > 0 && (
              <button
                onClick={handleDistributeEqually}
                className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Distribute Equally
              </button>
            )}
            <button
              onClick={handleAddQuestion}
              className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Question
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-600 mb-2">No questions yet</p>
            <p className="text-sm text-gray-500">Click "Add Question" to create your first question</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <QuestionItem
                key={question.id}
                question={question}
                index={index}
                onUpdate={handleUpdateQuestion}
                onDelete={handleDeleteQuestion}
              />
            ))}
          </div>
        )}
      </div>

      {/* Weight Summary Column */}
      <div className="lg:col-span-1">
        <WeightSummary validation={validation} />
      </div>
    </div>
  );
}
