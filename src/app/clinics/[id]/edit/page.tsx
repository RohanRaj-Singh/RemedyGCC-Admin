'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { Clinic } from '@/modules/clinic/types';
import { ClinicForm } from '@/modules/clinic/components';
import { clinicService } from '@/services/clinic-service';
import { getClinicStatusMeta } from '@/modules/clinic/utils';

export default function EditClinicPage() {
  const router = useRouter();
  const params = useParams();
  const clinicId = params?.id as string;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data, error: e } = await clinicService.getById(clinicId);
        if (!mounted) return;
        if (e || !data) throw new Error(e || 'Clinic not found.');
        setClinic(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load clinic.');
      } finally { if (mounted) setIsLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, [clinicId]);

  const handleSubmit = useCallback(async (data: Record<string, unknown>) => {
    try {
      setIsSaving(true);
      setError(null);
      const { data: updated, error: e } = await clinicService.update(clinicId, data);
      if (e || !updated) throw new Error(e || 'Failed to save.');
      router.push(`/clinics/${clinicId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
    } finally { setIsSaving(false); }
  }, [clinicId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Clinic Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">The requested clinic could not be found.</p>
          <Link href="/clinics" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Back to Clinics</Link>
        </div>
      </div>
    );
  }

  const statusMeta = getClinicStatusMeta(clinic.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href={`/clinics/${clinic.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Clinic
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Edit Clinic</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
              clinic.status === 'active' ? 'bg-green-100 text-green-700' :
              clinic.status === 'inactive' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {statusMeta.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{clinic.name}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
        <ClinicForm
          clinic={clinic}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/clinics/${clinic.id}`)}
          isLoading={isSaving}
          error={error}
        />
      </div>
    </div>
  );
}
