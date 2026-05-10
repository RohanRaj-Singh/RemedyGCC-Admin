'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { sumWeights } from '../utils/metrics';
import { validateScannerDraft } from '../utils/validation';

interface StickyHeaderProps {
  activeStep: number;
  steps: { title: string; description: string }[];
  categories: any[];
  validation: ReturnType<typeof validateScannerDraft>;
}

export function StickyHeader({ activeStep, steps, categories, validation }: StickyHeaderProps) {
  const [scannerWeight, setScannerWeight] = useState(0);
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    const weight = sumWeights(categories);
    setScannerWeight(weight);
    setIsValid(validation.isValid);
  }, [categories, validation]);

  const step = steps[activeStep];
  const issueCount = validation.issues.length;
  const blockingIssueCount = validation.issues.filter(i => i.blocking).length;

  return (
    <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="mx-auto max-w-[1520px] px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-medium text-gray-600">
            Step {activeStep + 1}: {step.title}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg">
                {scannerWeight === 100 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : scannerWeight > 100 ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {scannerWeight}% Weight
                </div>
                <div className="text-xs text-gray-500">
                  {scannerWeight === 100
                    ? 'Balanced ✅'
                    : scannerWeight > 100
                    ? `Overflow ${scannerWeight - 100}%`
                    : `Incomplete ${100 - scannerWeight}% remaining`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg">
                {issueCount === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : blockingIssueCount > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div>
                <div className="font-medium text-gray-900">
                  {issueCount} Issues
                </div>
                <div className="text-xs text-gray-500">
                  {blockingIssueCount > 0
                    ? `${blockingIssueCount} Blocking`
                    : 'Warnings only'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}