'use client';

import { Building2, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import type { Clinic } from '../types';

interface ClinicListProps {
  clinics: Clinic[];
  loading?: boolean;
}

const STATUS_STYLES: Record<string, { label: string; class: string }> = {
  active: { label: 'Active', class: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', class: 'bg-gray-100 text-gray-600' },
  archived: { label: 'Archived', class: 'bg-gray-100 text-gray-500' },
};

export function ClinicList({ clinics, loading }: ClinicListProps) {
  if (clinics.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Building2 className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No clinics found</h3>
        <p className="text-sm text-gray-500">Create your first clinic to get started.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {clinics.map((clinic) => {
        const statusStyle = STATUS_STYLES[clinic.status] || STATUS_STYLES.inactive;
        return (
          <Link
            key={clinic.id}
            href={`/clinics/${clinic.id}`}
            className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4 min-w-0">
              {/* Avatar */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                {clinic.logo ? (
                  <img src={clinic.logo} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-6 w-6 text-gray-400" />
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{clinic.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {clinic.address && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{clinic.address}</span>
                    </span>
                  )}
                  {clinic.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {clinic.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {clinic.nameAr && (
                <span className="hidden md:block text-sm text-gray-500" dir="rtl">
                  {clinic.nameAr}
                </span>
              )}
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyle.class}`}>
                {statusStyle.label}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
