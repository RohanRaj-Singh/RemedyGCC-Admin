'use client';

import { CheckCircle2, MessageSquareText, Plus } from 'lucide-react';
import { Category, Question, Subdomain } from '../types';
import { createEmptyQuestion } from '../utils/builder';
import { getSubdomainMetrics } from '../utils/metrics';
import { QuestionCard } from './QuestionCard';

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
  selectedSubdomainId,
  disabled = false,
  onSelectSubdomain,
  onSubdomainChange,
}: QuestionBuilderProps) {
  if (!category || !subdomain) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Select a category and subdomain first to manage questions.
      </div>
    );
  }

  const activeSubdomain = subdomain;
  const metrics = getSubdomainMetrics(activeSubdomain);

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
    onSubdomainChange({
      ...activeSubdomain,
      questions: [...activeSubdomain.questions, createEmptyQuestion(activeSubdomain.id)],
    });
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
              Keep each question short and easy to score. Follow-up questions stay inside
              the same weight system and inherit this subdomain as their parent.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full px-3 py-2 text-xs font-semibold ${
                metrics.balance.isExact
                  ? 'bg-emerald-50 text-emerald-700'
                  : metrics.balance.overflow > 0
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {metrics.questionWeightTotal} / {activeSubdomain.weight}% assigned
            </div>
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

        <div className="mt-5 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Subdomains in this category
            </div>
            <div className="mt-4 space-y-2">
              {category.subdomains.map((item, index) => {
                const isSelected = item.id === selectedSubdomainId;
                const itemMetrics = getSubdomainMetrics(item);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectSubdomain?.(item.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-200 bg-gray-50 hover:border-primary/30 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                          Subdomain {index + 1}
                        </div>
                        <div className="mt-1 font-medium text-gray-900">
                          {item.name.en || `Subdomain ${index + 1}`}
                        </div>
                      </div>
                      {itemMetrics.balance.isExact && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                      <span>{item.questions.length} questions</span>
                      <span>
                        {itemMetrics.questionWeightTotal} / {item.weight}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-gray-700">Question weight</span>
              <span className="font-semibold text-gray-900">
                {metrics.questionWeightTotal} / {activeSubdomain.weight}%
              </span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${
                  metrics.balance.isExact
                    ? 'bg-emerald-500'
                    : metrics.balance.overflow > 0
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                }`}
                style={{
                  width: `${Math.min(
                    (metrics.questionWeightTotal / Math.max(activeSubdomain.weight || 1, 1)) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
              <span>{metrics.questionCount} questions</span>
              <span>{metrics.followUpCount} follow-up questions</span>
              <span>
                {metrics.balance.isExact
                  ? 'Ready for review'
                  : metrics.balance.overflow > 0
                    ? `${metrics.balance.overflow}% overflow`
                    : `${metrics.balance.remaining}% remaining`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activeSubdomain.questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            parentWeight={activeSubdomain.weight}
            siblingQuestions={activeSubdomain.questions}
            disabled={disabled}
            canRemove={activeSubdomain.questions.length > 1}
            onUpdate={updateQuestion}
            onRemove={removeQuestion}
          />
        ))}
      </div>
    </div>
  );
}
