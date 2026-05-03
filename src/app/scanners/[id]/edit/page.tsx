/**
 * Edit Scanner Page
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { ScannerForm } from '@/modules/scanner/components';
import { getScannerById } from '@/modules/scanner/service';
import { ScannerDetail } from '@/modules/scanner/types';

export default function EditScannerPage() {
  const params = useParams();
  const [scanner, setScanner] = useState<ScannerDetail | null>(null);
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
                  <Edit3 className="h-3.5 w-3.5 text-primary" />
                  <span>Scanner Editor</span>
                </div>
                <h1 className="mt-2 text-3xl font-semibold text-gray-900">Edit Scanner</h1>
                <p className="mt-1 text-sm text-gray-500">{scanner.name.en}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Published versions stay immutable and any new structural edit moves into a draft.
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
        <ScannerForm scanner={scanner} />
      </div>
    </div>
  );
}
