'use client';

import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout';

export default function LogsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar activeTab="logs" />
      <main className="transition-all duration-300" style={{ marginLeft: '16rem' }}>
        <div className="h-16 border-b flex items-center px-6" style={{ borderColor: 'var(--border)' }}>
          <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>System Logs</h1>
        </div>
        <div className="p-6">
          <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: 'var(--border)' }}>
            <div className="w-16 h-16 rounded-full bg-[#126479]/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-[#126479]" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>System Logs</h2>
            <p className="text-[#1386a3] mb-6">This module is currently under development. Check back soon for real-time system logging and monitoring.</p>
            <Link href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#126479] text-white font-semibold rounded-lg hover:bg-[#126479]/90 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
