/**
 * Scanner Overview / Details Page
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, Edit3, Eye, FileText, CheckCircle2, Clock } from 'lucide-react';
import { getScannerById } from '@/modules/scanner/service';
import { ScannerDetail } from '@/modules/scanner/types';

export default function ScannerOverviewPage() {
  const params = useParams();
  const [scanner, setScanner] = useState<ScannerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScanner = async () => {
      const id = params.id as string;
      try {
        const data = await getScannerById(id);
        if (!data) {
          notFound();
        }
        setScanner(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    void loadScanner();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!scanner) {
    return null;
  }

  // Calculate some stats from the published version or draft
  const activeVersion = scanner.publishedVersion || scanner.draftVersion;
  const followUpCount = activeVersion?.followUpTriggers?.reduce(
    (total, trigger) => total + trigger.followUpQuestionIds.length,
    0
  ) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/scanners"
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{scanner.name.en}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {scanner.description?.en || 'No description provided'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/scanners/${scanner.id}/edit`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {scanner.hasUnpublishedChanges ? 'Continue Editing Draft' : 'Edit Scanner'}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Structural Summary
                </h2>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Categories</div>
                  <div className="text-3xl font-bold text-gray-900">{scanner.categoryCount}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Subdomains</div>
                  <div className="text-3xl font-bold text-gray-900">{scanner.subdomainCount}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Questions</div>
                  <div className="text-3xl font-bold text-gray-900">{scanner.questionCount}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Follow-ups</div>
                  <div className="text-3xl font-bold text-gray-900">{followUpCount}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {activeVersion?.categories.map((cat) => (
                  <div key={cat.id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">{cat.name.en}</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        Weight: {cat.weight}%
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {cat.subdomains.map((sub) => (
                        <div key={sub.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="font-medium text-sm text-gray-900 mb-1">{sub.name.en}</div>
                          <div className="text-xs text-gray-500 flex justify-between">
                            <span>{sub.questions.length} questions</span>
                            <span>{sub.weight}% weight</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-gray-400" />
                  Status
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Current Status</span>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    scanner.status === 'published' ? 'bg-green-100 text-green-700' :
                    scanner.status === 'archived' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {scanner.status.charAt(0).toUpperCase() + scanner.status.slice(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Version</span>
                  <span className="text-sm font-medium text-gray-900">
                    {scanner.activeVersionId ? `v${scanner.versions.find(v => v.id === scanner.activeVersionId)?.versionNumber}` : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Versions</span>
                  <span className="text-sm font-medium text-gray-900">{scanner.versionStats.total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Last Updated</span>
                  <span className="text-sm text-gray-900">
                    {new Date(scanner.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Runtime Submissions</span>
                  <span className="text-sm font-medium text-gray-900">
                    {scanner.hasResponses ? 'Yes' : 'None yet'}
                  </span>
                </div>
                {scanner.lastPublishedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Last Published</span>
                    <span className="text-sm text-gray-900">
                      {new Date(scanner.lastPublishedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Version History
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {scanner.versions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No versions yet. Create a draft to get started.
                  </div>
                ) : (
                  scanner.versions.map((version) => (
                    <div key={version.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-gray-900">
                            v{version.versionNumber}
                          </span>
                          {version.isActive && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {version.status === 'published' && !version.isActive && (
                            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Published
                            </span>
                          )}
                          {version.status === 'draft' && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Draft
                            </span>
                          )}
                          {version.status === 'archived' && (
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(version.createdAt).toLocaleDateString()}</span>
                        {version.publishedAt && (
                          <span>Published: {new Date(version.publishedAt).toLocaleDateString()}</span>
                        )}
                        {version.archivedAt && (
                          <span>Archived: {new Date(version.archivedAt).toLocaleDateString()}</span>
                        )}
                        {version.responseCount > 0 && (
                          <span className="text-gray-600">{version.responseCount} responses</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
