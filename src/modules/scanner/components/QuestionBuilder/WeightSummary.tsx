/**
 * Weight Summary Component
 * Shows total weight, remaining, and validation status
 */

'use client';

import { WeightValidation } from '../../types';

interface WeightSummaryProps {
  validation: WeightValidation;
}

export function WeightSummary({ validation }: WeightSummaryProps) {
  const progressPercent = (validation.total / 100) * 100;
  
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sticky top-4 z-10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Weight Distribution</h3>
        <span className={`text-sm font-semibold ${
          validation.hasError 
            ? 'text-red-600' 
            : validation.isValid 
              ? 'text-green-600' 
              : 'text-amber-600'
        }`}>
          {validation.total} / 100
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
        <div 
          className={`h-full transition-all duration-300 ${
            validation.hasError 
              ? 'bg-red-500' 
              : validation.isValid 
                ? 'bg-green-500' 
                : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
      
      {/* Status messages */}
      <div className="space-y-2">
        {validation.hasError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{validation.error}</span>
          </div>
        )}
        
        {validation.hasWarning && !validation.hasError && (
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{validation.warning}</span>
          </div>
        )}
        
        {validation.isValid && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Perfect! Total weight equals 100</span>
          </div>
        )}
      </div>
      
      {/* Remaining weight */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Remaining</span>
          <span className={`font-medium ${
            validation.remaining > 0 ? 'text-blue-600' : 'text-gray-700'
          }`}>
            {validation.remaining}
          </span>
        </div>
      </div>
    </div>
  );
}
