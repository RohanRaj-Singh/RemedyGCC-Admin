'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, X, Loader2 } from 'lucide-react';
import { LocalizedText } from '../types';

interface BreakingChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicate: (name: LocalizedText, description?: LocalizedText) => Promise<void>;
  scannerName: string;
  scannerId: string;
  responseCount: number;
  blockingChanges: {
    code: string;
    message: string;
    path: string;
  }[];
}

export function BreakingChangeModal({
  isOpen,
  onClose,
  onDuplicate,
  scannerName,
  scannerId,
  responseCount,
  blockingChanges,
}: BreakingChangeModalProps) {
  const [newName, setNewName] = useState<LocalizedText>({
    en: `${scannerName} (Copy)`,
    ar: `${scannerName} (Copy)`,
  });
  const [isDuplicating, setIsDuplicating] = useState(false);

  if (!isOpen) return null;

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      await onDuplicate(
        { en: newName.en.trim(), ar: newName.en.trim() },
        undefined
      );
      onClose();
    } catch (error) {
      console.error('Failed to duplicate:', error);
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
          <div className="rounded-full bg-red-100 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">
              Breaking Changes Detected
            </h3>
            <p className="text-sm text-red-700">
              This action cannot be completed
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700">
              This scanner already contains{' '}
              <span className="font-semibold text-gray-900">
                {responseCount} submission{responseCount !== 1 ? 's' : ''}
              </span>
              . The following changes would affect historical data integrity:
            </p>
          </div>

          {/* Blocking Changes List */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-32 overflow-y-auto">
            <ul className="space-y-2">
              {blockingChanges.slice(0, 5).map((change, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span className="text-gray-700">{change.message}</span>
                </li>
              ))}
              {blockingChanges.length > 5 && (
                <li className="text-sm text-gray-500 italic">
                  ...and {blockingChanges.length - 5} more changes
                </li>
              )}
            </ul>
          </div>

          {/* Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Scanner Name
            </label>
            <input
              type="text"
              value={newName.en}
              onChange={(e) => setNewName({ ...newName, en: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Why this matters:</strong> Changing scores, deleting questions,
              or modifying scoring behavior may corrupt historical analytics consistency.
              Your existing submission data relies on the current structure.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating || !newName.en.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isDuplicating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Duplicating...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Duplicate Scanner
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isDuplicating}
              className="w-full px-4 py-3 text-gray-600 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}