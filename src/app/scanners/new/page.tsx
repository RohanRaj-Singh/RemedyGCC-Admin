/**
 * New Scanner Page
 */

'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { ScannerForm } from '@/modules/scanner/components';

export default function NewScannerPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(245,249,247,1)_0%,rgba(249,250,251,1)_18%,rgba(249,250,251,1)_100%)]">
      <div className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/scanners"
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Super Admin</span>
                </div>
                <h1 className="mt-2 text-3xl font-semibold text-gray-900">Create Scanner</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Build a strict weighted assessment methodology with guided steps.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Categories, subdomains, and questions stay locked to the scanner rules.
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <ScannerForm />
      </div>
    </div>
  );
}
