'use client';

import { Question, ScannerFollowUpTrigger } from '../types';
import { createId } from '../utils/builder';

interface FollowUpTriggerEditorProps {
  question: Question;
  siblingQuestions: Question[];
  followUpTriggers?: ScannerFollowUpTrigger[];
  disabled?: boolean;
  onTriggersChange?: (triggers: ScannerFollowUpTrigger[]) => void;
}

export function FollowUpTriggerEditor({
  question,
  siblingQuestions,
  followUpTriggers = [],
  disabled = false,
  onTriggersChange,
}: FollowUpTriggerEditorProps) {
  if (question.kind !== 'follow-up') {
    return null;
  }

  const currentIndex = siblingQuestions.findIndex((q) => q.id === question.id);
  const precedingPrimaryQuestions = siblingQuestions
    .slice(0, currentIndex)
    .filter((q) => q.kind === 'primary');

  if (precedingPrimaryQuestions.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
        A follow-up question must be placed after at least one primary question.
      </div>
    );
  }

  const existingTrigger = followUpTriggers.find((t) => t.followUpQuestionIds.includes(question.id));
  const selectedTriggerQuestionId =
    existingTrigger?.triggerQuestionId ?? precedingPrimaryQuestions[precedingPrimaryQuestions.length - 1].id;

  const triggerQuestion = precedingPrimaryQuestions.find((q) => q.id === selectedTriggerQuestionId);

  function handleTriggerQuestionChange(newTriggerQuestionId: string) {
    if (!onTriggersChange) return;

    // Remove this question from its current trigger (if any)
    let newTriggers = followUpTriggers.map((t) => ({
      ...t,
      followUpQuestionIds: t.followUpQuestionIds.filter((id) => id !== question.id),
    })).filter(t => t.followUpQuestionIds.length > 0);

    // If newTriggerQuestionId exists, either add to its existing trigger or create a new one
    // But triggers are unique per triggerQuestionId
    const targetTrigger = newTriggers.find((t) => t.triggerQuestionId === newTriggerQuestionId);
    
    if (targetTrigger) {
      newTriggers = newTriggers.map((t) => 
        t.id === targetTrigger.id 
          ? { ...t, followUpQuestionIds: [...t.followUpQuestionIds, question.id] }
          : t
      );
    } else {
      newTriggers.push({
        id: createId('trigger'),
        triggerQuestionId: newTriggerQuestionId,
        triggerOptionIds: [],
        followUpQuestionIds: [question.id],
      });
    }

    onTriggersChange(newTriggers);
  }

  function handleOptionToggle(optionId: string, isChecked: boolean) {
    if (!onTriggersChange || !triggerQuestion) return;

    let newTriggers = [...followUpTriggers];
    let trigger = newTriggers.find((t) => t.followUpQuestionIds.includes(question.id));

    if (!trigger) {
      trigger = {
        id: createId('trigger'),
        triggerQuestionId: triggerQuestion.id,
        triggerOptionIds: [],
        followUpQuestionIds: [question.id],
      };
      newTriggers.push(trigger);
    }

    if (isChecked) {
      trigger.triggerOptionIds = [...trigger.triggerOptionIds, optionId];
    } else {
      trigger.triggerOptionIds = trigger.triggerOptionIds.filter((id) => id !== optionId);
    }

    onTriggersChange(newTriggers);
  }

  const currentOptionIds = existingTrigger?.triggerOptionIds ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Trigger Question
        </label>
        <select
          value={selectedTriggerQuestionId}
          disabled={disabled}
          onChange={(e) => handleTriggerQuestionChange(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
        >
          {precedingPrimaryQuestions.map((pq) => (
            <option key={pq.id} value={pq.id}>
              {pq.text.en || 'Untitled primary question'}
            </option>
          ))}
        </select>
      </div>

      {triggerQuestion && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Trigger Options
          </div>
          <div className="space-y-2">
            {triggerQuestion.options.map((option) => {
              const isChecked = currentOptionIds.includes(option.id);

              return (
                <label
                  key={option.id}
                  className="flex items-center gap-3 rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => handleOptionToggle(option.id, e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
