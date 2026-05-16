'use client';

import { useState } from 'react';
import { Copy, X, Loader2, AlertCircle } from 'lucide-react';
import { LocalizedText } from '../types';

interface DuplicateScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDuplicate: (name: LocalizedText, description?: LocalizedText) => Promise<void>;
  sourceScannerName: string;
  sourceScannerId: string;
}

export function DuplicateScannerModal({
  isOpen,
  onClose,
  onDuplicate,
  sourceScannerName,
  sourceScannerId,
}: DuplicateScannerModalProps) {
  const [name, setName] = useState<LocalizedText>({
    en: `${sourceScannerName} (Copy)`,
    ar: `${sourceScannerName} (Copy)`,
  });
  const [description, setDescription] = useState<LocalizedText>({
    en: '',
    ar: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.en.trim()) {
      setError('Scanner name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onDuplicate(
        { en: name.en.trim(), ar: name.ar.trim() || name.en.trim() },
        description.en.trim() ? { en: description.en.trim(), ar: description.ar.trim() || description.en.trim() } : undefined
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate scanner');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-50 px-6 py-4 flex items-center gap-3 border-b border-blue-100">
          <div className="rounded-full bg-blue-100 p-2">
            <Copy className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Duplicate Scanner
            </h3>
            <p className="text-sm text-blue-700">
              Create an independent copy
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-blue-400 hover:text-blue-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Source Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-500 mb-1">Duplicating from:</div>
            <div className="font-semibold text-gray-900">{sourceScannerName}</div>
            <div className="text-xs text-gray-400 mt-1">ID: {sourceScannerId}</div>
          </div>

          {/* Name Input */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Scanner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name.en}
              onChange={(e) => setName({ ...name, en: e.target.value })}
              placeholder="e.g., Healthcare Wellness Scanner 2027"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the name for your new independent scanner
            </p>
          </div>

          {/* English Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description.en}
              onChange={(e) => setDescription({ ...description, en: e.target.value })}
              placeholder="Add a description for the new scanner..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                This will create a completely independent scanner. You can freely modify scores,
                restructure the hierarchy, or delete questions without affecting the original scanner.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={isLoading || !name.en.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
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
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full px-4 py-3 text-gray-600 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}