/**
 * Edit Scanner Page
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Scanner } from '@/modules/scanner/types';
import { getScannerById } from '@/modules/scanner/service';
import { ScannerForm } from '@/modules/scanner/components';

export default function EditScannerPage() {
  const params = useParams();
  const router = useRouter();
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScanner = async () => {
      const id = params.id as string;
      const data = await getScannerById(id);
      if (!data) {
        notFound();
      }
      setScanner(data);
      setLoading(false);
    };
    loadScanner();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!scanner) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/scanners"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Scanner</h1>
              <p className="mt-1 text-sm text-gray-500">
                {scanner.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ScannerForm scanner={scanner} />
      </div>
    </div>
  );
}
