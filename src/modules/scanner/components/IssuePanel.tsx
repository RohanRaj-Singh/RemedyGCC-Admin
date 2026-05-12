import { AlertTriangle, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';
import { ValidationIssue } from '../types';

interface IssuePanelProps {
  issues: ValidationIssue[];
  onClose: () => void;
  onNavigate?: (issue: ValidationIssue) => void;
}

export function IssuePanel({ issues, onClose, onNavigate }: IssuePanelProps) {
  const blockingIssues = issues.filter((i) => i.blocking);
  const warningIssues = issues.filter((i) => !i.blocking && i.severity === 'warning');
  const infoIssues = issues.filter((i) => !i.blocking && i.severity === 'info');

  const groupedIssues = issues.reduce((acc, issue) => {
    const key = issue.categoryId || 'global';
    if (!acc[key]) {
      acc[key] = {
        categoryName: issue.categoryName || 'General Scanner Settings',
        issues: [],
      };
    }
    acc[key].issues.push(issue);
    return acc;
  }, {} as Record<string, { categoryName: string; issues: ValidationIssue[] }>);

  const getSeverityIcon = (severity: string) => {
    if (severity === 'error') return <AlertTriangle size={16} className="text-red-500" />;
    if (severity === 'warning') return <AlertTriangle size={16} className="text-amber-500" />;
    return <Info size={16} className="text-blue-500" />;
  };

  const getSeverityStyles = (severity: string) => {
    if (severity === 'error') return 'bg-red-50 border-red-100 text-red-900 hover:bg-red-100';
    if (severity === 'warning') return 'bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100';
    return 'bg-blue-50 border-blue-100 text-blue-900 hover:bg-blue-100';
  };

  const getSeverityLabelColor = (severity: string) => {
    if (severity === 'error') return 'text-red-600';
    if (severity === 'warning') return 'text-amber-600';
    return 'text-blue-600';
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900">Validation Status</h3>
          <div className="text-xs text-gray-500 flex gap-3 mt-1">
            {blockingIssues.length > 0 && <span className="text-red-600 font-medium">{blockingIssues.length} Errors</span>}
            {warningIssues.length > 0 && <span className="text-amber-600 font-medium">{warningIssues.length} Warnings</span>}
            {infoIssues.length > 0 && <span className="text-blue-600 font-medium">{infoIssues.length} Info</span>}
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 text-center px-4">
            <CheckCircle2 size={48} className="text-green-500" />
            <div className="space-y-1">
              <p className="font-semibold text-gray-900">Scanner structure validated successfully.</p>
              <p className="text-sm">No blocking runtime or publishing issues found.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedIssues).map(([key, group]) => (
              <div key={key} className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b border-gray-100">
                  {group.categoryName}
                </h4>
                <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                  {group.issues.map((issue) => (
                    <div 
                      key={issue.id} 
                      onClick={() => onNavigate?.(issue)}
                      className={`p-3 border rounded-lg text-sm shadow-sm cursor-pointer transition-colors ${getSeverityStyles(issue.severity)}`}
                    >
                      <div className="flex gap-2">
                        <div className="mt-0.5">{getSeverityIcon(issue.severity)}</div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium">{issue.message}</p>
                          
                          {(issue.subdomainName || issue.questionText || issue.answerLabel) && (
                            <div className="text-xs opacity-80 mt-2 flex flex-wrap items-center gap-1.5">
                              {issue.subdomainName && (
                                <>
                                  <span className="font-medium truncate max-w-[120px]" title={issue.subdomainName}>{issue.subdomainName}</span>
                                </>
                              )}
                              {issue.questionText && (
                                <>
                                  {issue.subdomainName && <ChevronRight size={12} className="opacity-50" />}
                                  <span className="font-medium truncate max-w-[150px]" title={issue.questionText}>{issue.questionText}</span>
                                </>
                              )}
                              {issue.answerLabel && (
                                <>
                                  <ChevronRight size={12} className="opacity-50" />
                                  <span className="font-medium truncate max-w-[100px]" title={issue.answerLabel}>{issue.answerLabel}</span>
                                </>
                              )}
                            </div>
                          )}
                          
                          <span className={`text-[10px] font-bold uppercase tracking-wider block mt-2 ${getSeverityLabelColor(issue.severity)}`}>
                            {issue.level}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
