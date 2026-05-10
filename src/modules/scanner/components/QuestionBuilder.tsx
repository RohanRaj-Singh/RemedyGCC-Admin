'use client';

import { useState } from 'react';
import { MessageSquareText, Plus } from 'lucide-react';
import { Category, Question, Subdomain } from '../types';
import { createEmptyQuestion } from '../utils/builder';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableQuestionCard } from './SortableQuestionCard';

interface QuestionBuilderProps {
  category?: Category;
  subdomain?: Subdomain;
  selectedSubdomainId?: string;
  disabled?: boolean;
  onSelectSubdomain?: (subdomainId: string) => void;
  onSubdomainChange: (subdomain: Subdomain) => void;
}

export function QuestionBuilder({
  category,
  subdomain,
  disabled = false,
  onSubdomainChange,
}: QuestionBuilderProps) {
  const [openQuestionId, setOpenQuestionId] = useState<string | undefined>(undefined);

  if (!category || !subdomain) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Select a subdomain from the sidebar to manage questions.
      </div>
    );
  }

  const activeSubdomain = subdomain;

  function updateQuestion(updatedQuestion: Question) {
    onSubdomainChange({
      ...activeSubdomain,
      questions: activeSubdomain.questions.map((question) =>
        question.id === updatedQuestion.id ? updatedQuestion : question
      ),
    });
  }

  function removeQuestion(questionId: string) {
    if (activeSubdomain.questions.length === 1) {
      return;
    }

    onSubdomainChange({
      ...activeSubdomain,
      questions: activeSubdomain.questions.filter((question) => question.id !== questionId),
    });
  }

  function addQuestion() {
    const newQuestion = createEmptyQuestion(activeSubdomain.id);
    onSubdomainChange({
      ...activeSubdomain,
      questions: [...activeSubdomain.questions, newQuestion],
    });
    setOpenQuestionId(newQuestion.id);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = activeSubdomain.questions.findIndex((q) => q.id === active.id);
      const newIndex = activeSubdomain.questions.findIndex((q) => q.id === over.id);

      let newQuestions = arrayMove(activeSubdomain.questions, oldIndex, newIndex);

      // Validation logic: if a trigger question is moved away from its dependent follow-up question
      // we need to make sure follow-up questions always have a preceding question.
      // And we also update their triggerCondition.questionId to the newly preceding question.
      newQuestions = newQuestions.map((q, idx) => {
        if (q.isFollowUp) {
          const prev = newQuestions[idx - 1];
          if (prev && q.triggerCondition?.questionId !== prev.id) {
            // Update trigger ID, but we might want to clear optionIds if the trigger changed
            return {
              ...q,
              triggerCondition: {
                questionId: prev.id,
                optionIds: [], // Reset options because the trigger changed
              }
            };
          }
        }
        return q;
      });

      onSubdomainChange({
        ...activeSubdomain,
        questions: newQuestions,
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.75rem] border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              <MessageSquareText className="h-3.5 w-3.5 text-primary" />
              <span>Question Builder</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-gray-900">
              {activeSubdomain.name.en || 'Selected subdomain'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Add questions and their options. Weights will be assigned in the next step.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>
        </div>
      </div>

      {activeSubdomain.questions.length === 0 ? (
        <div className="space-y-5">
          <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white p-12 text-center flex flex-col items-center justify-center">
            <MessageSquareText className="h-10 w-10 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No questions yet</h3>
            <p className="text-sm text-gray-500 mb-6">Add your first question to {activeSubdomain.name.en || 'this subdomain'}.</p>
            <button
              type="button"
              disabled={disabled}
              onClick={addQuestion}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeSubdomain.questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {activeSubdomain.questions.map((question, index) => {
                const isInvalidFollowUp = question.isFollowUp && index === 0;

                return (
                  <SortableQuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    siblingQuestions={activeSubdomain.questions}
                    disabled={disabled}
                    canRemove={activeSubdomain.questions.length > 1}
                    isOpen={openQuestionId === question.id || (activeSubdomain.questions.length === 1)}
                    dragError={isInvalidFollowUp}
                    onToggle={() => setOpenQuestionId(openQuestionId === question.id ? undefined : question.id)}
                    onUpdate={updateQuestion}
                    onRemove={removeQuestion}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
