'use client';

import { ChevronDown, MessageSquarePlus, Trash2 } from 'lucide-react';
import { Question } from '../types';
import { createEmptyOption } from '../utils/builder';
import { getQuestionOptionCount } from '../utils/metrics';
import { FollowUpTriggerEditor } from './FollowUpTriggerEditor';

import { ScannerFollowUpTrigger } from '../types';

interface QuestionCardProps {
  question: Question;
  index: number;
  siblingQuestions: Question[];
  disabled?: boolean;
  canRemove: boolean;
  isOpen: boolean;
  dragError?: boolean;
  followUpTriggers?: ScannerFollowUpTrigger[];
  onToggle: () => void;
  onUpdate: (question: Question) => void;
  onRemove: (questionId: string) => void;
  onTriggersChange?: (triggers: ScannerFollowUpTrigger[]) => void;
}

export function QuestionCard({
  question,
  index,
  siblingQuestions,
  disabled = false,
  canRemove,
  isOpen,
  dragError,
  followUpTriggers,
  onToggle,
  onUpdate,
  onRemove,
  onTriggersChange,
}: QuestionCardProps) {
  const tone = dragError
    ? 'border-red-300 bg-red-50/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
    : question.kind === 'follow-up'
      ? 'border-amber-200 bg-amber-50/70'
      : 'border-gray-200 bg-white';

  return (
    <div className={`rounded-[1.5rem] border shadow-sm overflow-hidden transition-all ${tone}`}>
      <div 
        className="p-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary bg-primary/10' : 'text-gray-400'}`}>
            <ChevronDown size={18} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              <span>Question {index + 1}</span>
              {question.kind === 'follow-up' && (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] text-amber-700">
                  Follow-up
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 truncate max-w-xl">
              {question.text.en || 'Untitled Question'}
            </div>
            <div className="text-xs text-gray-500">
              {getQuestionOptionCount(question)} options
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={question.kind === 'follow-up'}
              onChange={(event) =>
                onUpdate({
                  ...question,
                  kind: event.target.checked ? 'follow-up' : 'primary',
                })
              }
            />
            <span>Follow-up</span>
          </label>

          <button
            type="button"
            disabled={disabled || !canRemove}
            onClick={() => onRemove(question.id)}
            className="inline-flex items-center justify-center rounded-xl border border-transparent p-3 text-gray-400 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Remove question"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-5 pt-0 border-t border-gray-100/50 mt-2">
            <div className="grid gap-4 xl:grid-cols-2 mt-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Question Text
                </label>
                <textarea
                  rows={3}
                  disabled={disabled}
                  value={question.text.en}
                  onChange={(event) =>
                    onUpdate({
                      ...question,
                      text: { ...question.text, en: event.target.value },
                    })
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                  placeholder="Question text in English"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  Arabic Text
                </label>
                <textarea
                  rows={3}
                  dir="rtl"
                  disabled={disabled}
                  value={question.text.ar}
                  onChange={(event) =>
                    onUpdate({
                      ...question,
                      text: { ...question.text, ar: event.target.value },
                    })
                  }
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                  placeholder="Question text in Arabic"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-100 bg-white/85 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Answer options</div>
                  <div className="mt-1 text-sm text-gray-500">
                    Keep options concise and score values easy to reason about.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onUpdate({
                      ...question,
                      options: [...question.options, createEmptyOption(question.options.length + 1)],
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Add Option
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={option.id}
                    className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_auto]"
                  >
                    <input
                      value={option.label.en}
                      disabled={disabled}
                      onChange={(event) =>
                        onUpdate({
                          ...question,
                          options: question.options.map((item) =>
                            item.id === option.id
                              ? {
                                  ...item,
                                  label: { ...item.label, en: event.target.value },
                                }
                              : item
                          ),
                        })
                      }
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                      placeholder={`Option ${optionIndex + 1} in English`}
                    />

                    <input
                      value={option.label.ar}
                      dir="rtl"
                      disabled={disabled}
                      onChange={(event) =>
                        onUpdate({
                          ...question,
                          options: question.options.map((item) =>
                            item.id === option.id
                              ? {
                                  ...item,
                                  label: { ...item.label, ar: event.target.value },
                                }
                              : item
                          ),
                        })
                      }
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                      placeholder="Option in Arabic"
                    />

                    <div className="relative">
                      <input
                        type="number"
                        disabled={disabled}
                        value={option.score}
                        onChange={(event) =>
                          onUpdate({
                            ...question,
                            options: question.options.map((item) =>
                              item.id === option.id
                                ? {
                                    ...item,
                                    score: Number(event.target.value),
                                  }
                                : item
                            ),
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100"
                        placeholder="Score"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={disabled || question.options.length <= 2}
                      onClick={() =>
                        onUpdate({
                          ...question,
                          options: question.options.filter((item) => item.id !== option.id),
                        })
                      }
                      className="rounded-xl border border-transparent px-3 py-2 text-sm text-gray-500 transition hover:border-red-100 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <FollowUpTriggerEditor
                question={question}
                siblingQuestions={siblingQuestions}
                followUpTriggers={followUpTriggers}
                disabled={disabled}
                onTriggersChange={onTriggersChange}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
