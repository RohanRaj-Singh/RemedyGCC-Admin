'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ClinicForm } from '@/modules/clinic/components';
import { clinicService } from '@/services/clinic-service';
import type { CreateClinicDto } from '@/modules/clinic/types';

export default function NewClinicPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      setIsLoading(true);
      setError(null);
      const { data: clinic, error: createError } = await clinicService.create(data as unknown as CreateClinicDto);
      if (createError || !clinic) throw new Error(createError || 'Failed to create clinic.');
      router.push(`/clinics/${clinic.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create clinic.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/clinics" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to Clinics
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Add New Clinic</h1>
          <p className="mt-1 text-sm text-gray-500">
            Register a new healthcare provider in the clinic directory.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
        <ClinicForm
          onSubmit={handleSubmit}
          onCancel={() => router.push('/clinics')}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
