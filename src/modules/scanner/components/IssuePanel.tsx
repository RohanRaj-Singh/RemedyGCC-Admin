import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ValidationIssue } from '../types';

interface IssuePanelProps {
  issues: ValidationIssue[];
  onClose: () => void;
}

export function IssuePanel({ issues, onClose }: IssuePanelProps) {
  const blockingIssues = issues.filter((i) => i.blocking);
  const warningIssues = issues.filter((i) => !i.blocking);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl border-l border-gray-200 flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <h3 className="font-semibold text-gray-900">Validation Issues</h3>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <CheckCircle2 size={48} className="text-green-500" />
            <p>No validation issues found.</p>
          </div>
        ) : (
          <>
            {blockingIssues.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Blocking Errors ({blockingIssues.length})
                </h4>
                {blockingIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-900 shadow-sm cursor-pointer hover:bg-red-100 transition-colors">
                    <p className="font-medium">{issue.message}</p>
                    <span className="text-xs text-red-600 font-semibold uppercase tracking-wider block mt-1">
                      {issue.level}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {warningIssues.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Warnings ({warningIssues.length})
                </h4>
                {warningIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-900 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors">
                    <p className="font-medium">{issue.message}</p>
                    <span className="text-xs text-amber-600 font-semibold uppercase tracking-wider block mt-1">
                      {issue.level}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
