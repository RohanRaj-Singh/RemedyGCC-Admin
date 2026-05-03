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
  const availableSourceQuestions = siblingQuestions.filter((item) => item.id !== question.id);
  const selectedSourceQuestion = availableSourceQuestions.find(
    (item) => item.id === question.triggerCondition?.questionId
  );

  if (!question.isFollowUp) {
    return null;
  }

  if (availableSourceQuestions.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">
        Add at least one non-current question in this subdomain before configuring a follow-up trigger.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Trigger Question
        </label>
        <select
          disabled={disabled}
          value={question.triggerCondition?.questionId ?? ''}
          onChange={(event) =>
            onChange({
              ...question,
              triggerCondition: {
                questionId: event.target.value,
                optionIds: [],
              },
            })
          }
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
        >
          <option value="">Select trigger question</option>
          {availableSourceQuestions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.text.en || 'Untitled question'}
            </option>
          ))}
        </select>
      </div>

      {selectedSourceQuestion && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Trigger Options
          </div>
          <div className="space-y-2">
            {selectedSourceQuestion.options.map((option) => {
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
                          questionId: selectedSourceQuestion.id,
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
      )}
    </div>
  );
}
