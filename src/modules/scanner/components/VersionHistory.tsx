'use client';

import { CopyPlus, GitBranch, LockKeyhole, MessageSquareText } from 'lucide-react';
import { ScannerVersionSummary } from '../types';

interface VersionHistoryProps {
  versions: ScannerVersionSummary[];
  canCreateVersion: boolean;
  onCreateVersion: () => void;
  loading?: boolean;
}

export function VersionHistory({
  versions,
  canCreateVersion,
  onCreateVersion,
  loading = false,
}: VersionHistoryProps) {
  return (
    <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Version History
            </div>
            <h3 className="mt-2 text-xl font-semibold text-gray-900">Immutable releases</h3>
            <p className="mt-1 text-sm text-gray-600">
              Published versions stay frozen. Any new structural edit happens in a new draft clone.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateVersion}
            disabled={!canCreateVersion || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CopyPlus className="h-4 w-4" />
            New Version
          </button>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <LockKeyhole className="h-4 w-4 text-primary" />
            <span>Version-safe editing</span>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            If a released version already has responses, it remains unchanged and future edits move to a new version.
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {versions.map((version) => (
          <div
            key={version.id}
            className="rounded-2xl border border-gray-100 bg-gray-50 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-gray-900">v{version.versionNumber}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      version.status === 'published'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {version.status}
                  </span>
                  {version.isImmutable && (
                    <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                      locked
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Created {new Date(version.createdAt).toLocaleDateString()}.
                  {version.publishedAt
                    ? ` Published ${new Date(version.publishedAt).toLocaleDateString()}.`
                    : ' Not published yet.'}
                </div>
              </div>

              <div className="rounded-xl border border-white bg-white px-3 py-2 text-right shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  <MessageSquareText className="h-3.5 w-3.5 text-primary" />
                  <span>Responses</span>
                </div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{version.responseCount}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
