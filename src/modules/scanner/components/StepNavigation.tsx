'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface BuilderStep {
  title: string;
  description: string;
}

interface StepNavigationProps {
  steps: BuilderStep[];
  activeStep: number;
  onStepChange: (stepIndex: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export function StepNavigation({
  steps,
  activeStep,
  onStepChange,
  onPrevious,
  onNext,
}: StepNavigationProps) {
  const currentStep = steps[activeStep];

  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <span>Guided Builder</span>
            <span className="text-gray-300">/</span>
            <span>Step {activeStep + 1} of {steps.length}</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">{currentStep.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">{currentStep.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={activeStep === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={activeStep === steps.length - 1}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="grid min-w-[760px] grid-cols-5 gap-3">
          {steps.map((step, index) => {
            const state =
              index === activeStep ? 'current' : index < activeStep ? 'complete' : 'upcoming';

            return (
              <button
                key={step.title}
                type="button"
                onClick={() => onStepChange(index)}
                className={`group rounded-2xl border px-4 py-4 text-left transition ${
                  state === 'current'
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : state === 'complete'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                    state === 'current' ? 'text-white/75' : state === 'complete' ? 'text-emerald-700' : 'text-gray-400'
                  }`}>
                    Step {index + 1}
                  </span>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      state === 'current'
                        ? 'bg-white/20 text-white'
                        : state === 'complete'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>
                <div className="mt-3 font-medium">{step.title}</div>
                <div className={`mt-1 text-xs leading-5 ${
                  state === 'current' ? 'text-white/75' : state === 'complete' ? 'text-emerald-700/90' : 'text-gray-500'
                }`}>
                  {step.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
