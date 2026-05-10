'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ValidationIssue } from '../types';
import { IssuePanel } from './IssuePanel';

interface FloatingIssueButtonProps {
  issues: ValidationIssue[];
}

export function FloatingIssueButton({ issues }: FloatingIssueButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const blockingIssues = issues.filter(i => i.blocking);
  const warningIssues = issues.filter(i => !i.blocking);
  const totalIssues = issues.length;

  let buttonRing = 'ring-green-500 bg-green-50 text-green-700';
  let Icon = CheckCircle2;

  if (blockingIssues.length > 0) {
    buttonRing = 'ring-red-500 bg-white text-red-600';
    Icon = AlertTriangle;
  } else if (warningIssues.length > 0) {
    buttonRing = 'ring-amber-500 bg-white text-amber-600';
    Icon = AlertTriangle;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg border border-gray-200 flex items-center justify-center cursor-pointer hover:shadow-xl transition-all ring-2 ring-offset-2 ${buttonRing} z-40`}
      >
        <div className="relative">
          <Icon size={24} />
          {totalIssues > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
              {totalIssues}
            </span>
          )}
        </div>
      </button>

      {isOpen && <IssuePanel issues={issues} onClose={() => setIsOpen(false)} />}
      
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
