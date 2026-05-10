'use client';

import { Question } from '../types';

interface FollowUpTriggerEditorProps {
  question: Question;
  siblingQuestions: Question[];
  disabled?: boolean;
  onChange: (question: Question) => void;
}

export function FollowUpTriggerEditor({
  question,
  siblingQuestions,
  disabled = false,
  onChange,
}: FollowUpTriggerEditorProps) {
  const currentIndex = siblingQuestions.findIndex(q => q.id === question.id);
  const precedingQuestion = currentIndex > 0 ? siblingQuestions[currentIndex - 1] : null;

  if (!question.isFollowUp) {
    return null;
  }

  if (!precedingQuestion) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
        A follow-up question must have a preceding question to trigger it. Please move this question down.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="text-sm font-medium text-gray-700 bg-white p-3 rounded-xl border border-gray-200">
        <span className="text-gray-500 mr-2">Trigger Question:</span>
        {precedingQuestion.text.en || 'Untitled question'}
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Trigger Options
        </div>
        <div className="space-y-2">
          {precedingQuestion.options.map((option) => {
            const isChecked = question.triggerCondition?.optionIds.includes(option.id) ?? false;

            return (
              <label
                key={option.id}
                className="flex items-center gap-3 rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(event) => {
                    const currentIds = question.triggerCondition?.optionIds ?? [];
                    const optionIds = event.target.checked
                      ? [...currentIds, option.id]
                      : currentIds.filter((item) => item !== option.id);

                    onChange({
                      ...question,
                      triggerCondition: {
                        questionId: precedingQuestion.id,
                        optionIds,
                      },
                    });
                  }}
                />
                <span>{option.label.en || 'Untitled option'}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
