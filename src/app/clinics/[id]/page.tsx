'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Edit, ExternalLink, Globe, Loader2, Mail, MapPin, Phone,
  Play, Send, ShieldOff, Trash2,
} from 'lucide-react';
import type { Clinic, DeleteClinicConsequences } from '@/modules/clinic/types';
import { clinicService } from '@/services/clinic-service';
import { getClinicStatusMeta } from '@/modules/clinic/utils';

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#15803d', bg: 'rgba(34, 197, 94, 0.12)' },
  inactive: { label: 'Inactive', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)' },
  archived: { label: 'Archived', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
};

const STATUS_DESC: Record<string, string> = {
  active: 'This clinic is visible on the directory.',
  inactive: 'This clinic is not visible on the directory.',
  archived: 'This clinic is archived and cannot be modified.',
};

export default function ClinicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clinicId = params?.id as string;

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteSlug, setDeleteSlug] = useState('');
  const [deleteConsequences, setDeleteConsequences] = useState<DeleteClinicConsequences | null>(null);

  const sm = clinic ? (STATUS_META[clinic.status] || STATUS_META.inactive) : null;

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: e } = await clinicService.getById(clinicId);
      if (e || !data) throw new Error(e || 'Clinic not found.');
      setClinic(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clinic.');
    } finally { setIsLoading(false); }
  }, [clinicId]);

  useEffect(() => { void load(); }, [load]);

  const go = async (fn: () => Promise<unknown>, msg: string) => {
    try { setIsActing(true); setError(null); setSuccess(null); await fn(); setSuccess(msg); } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally { setIsActing(false); }
  };

  const activate = () => go(
    async () => { const r = await clinicService.update(clinicId, { status: 'active' }); if (r.data) setClinic(r.data); },
    'Clinic is now active.',
  );
  const deactivate = () => go(
    async () => { const r = await clinicService.update(clinicId, { status: 'inactive' }); if (r.data) setClinic(r.data); },
    'Clinic has been deactivated.',
  );
  const archive = () => go(
    async () => { const r = await clinicService.update(clinicId, { status: 'archived' }); if (r.data) setClinic(r.data); setShowArchive(false); },
    'Clinic has been archived.',
  );

  const handleDeleteClick = async () => {
    try {
      const { data, error: e } = await clinicService.previewDelete(clinicId);
      if (e || !data) throw new Error(e || 'Failed.');
      setDeleteConsequences(data); setDeleteSlug(''); setShowDelete(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConsequences) return;
    try {
      setIsActing(true); setError(null);
      const { error: e } = await clinicService.delete(clinicId, { slug: deleteSlug });
      if (e) throw new Error(e);
      router.push('/clinics');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed.'); } finally { setIsActing(false); }
  };

  const statClass = 'rounded-xl border border-gray-200 p-4';
  const displayName = (clinic?.nameAr && clinic.nameAr !== clinic.name) ? clinic.nameAr : null;

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/clinics" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Clinics
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
              {displayName && <p className="text-sm text-gray-500 mt-0.5" dir="rtl">{displayName}</p>}
            </div>
            {clinic.status !== 'archived' && (
              <Link href={`/clinics/${clinic.id}/edit`}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Edit className="h-4 w-4" /> Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Messages */}
        {success && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success}</div>}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {/* Status Banner */}
        {sm && (
          <div className="rounded-xl border border-gray-200 bg-white p-5" style={{ backgroundColor: sm.bg }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                  <Building2 className="h-6 w-6" style={{ color: sm.color }} />
                </div>
                <div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold`}
                    style={{ backgroundColor: sm.bg, color: sm.color }}>{sm.label}</span>
                  <p className="mt-1 text-sm text-gray-600">{STATUS_DESC[clinic.status] || ''}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {clinic.status === 'inactive' && (
                  <button onClick={activate} disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Play className="h-4 w-4" /> Activate
                  </button>
                )}
                {clinic.status === 'active' && (
                  <button onClick={deactivate} disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    <ShieldOff className="h-4 w-4" /> Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact & Location */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Contact</h3>
            <div className="space-y-3">
              {clinic.phone && (
                <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-gray-400 shrink-0" /><span>{clinic.phone}</span></div>
              )}
              {clinic.email && (
                <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-gray-400 shrink-0" /><span>{clinic.email}</span></div>
              )}
              {clinic.website && (
                <div className="flex items-center gap-3 text-sm"><Globe className="h-4 w-4 text-gray-400 shrink-0" />
                  <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                    {clinic.website.replace(/^https?:\/\//, '')} <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </div>
              )}
              {!clinic.phone && !clinic.email && !clinic.website && <p className="text-sm text-gray-400">No contact information.</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Location</h3>
            {clinic.address ? (
              <div className="flex items-start gap-3 text-sm">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p>{clinic.address}</p>
                  {clinic.addressAr && <p className="mt-1 text-gray-500" dir="rtl">{clinic.addressAr}</p>}
                  {clinic.coordinates?.lat && clinic.coordinates?.lng && (
                    <p className="mt-1.5 text-xs text-gray-400">{clinic.coordinates.lat}, {clinic.coordinates.lng}</p>
                  )}
                  {clinic.googleMapsUrl && (
                    <a href={clinic.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      Open in Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">No address provided.</p>}
          </div>
        </div>

        {/* Description */}
        {(clinic.description || clinic.descriptionAr) && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Description</h3>
            {clinic.description && <p className="text-sm text-gray-700 leading-relaxed">{clinic.description}</p>}
            {clinic.descriptionAr && <p className="mt-3 text-sm text-gray-600 leading-relaxed" dir="rtl">{clinic.descriptionAr}</p>}
          </div>
        )}

        {/* Working Hours */}
        {(clinic.workingHours?.length || clinic.workingHoursAr?.length) ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Working Hours</h3>
            <div className="grid gap-5 md:grid-cols-2">
              {clinic.workingHours && clinic.workingHours.length > 0 && (
                <div>
                  <table className="w-full text-sm">
                    <tbody>
                      {clinic.workingHours.map((h) => (
                        <tr key={h.day} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-gray-700 w-32">{h.day}</td>
                          <td className="py-2 text-gray-500">{h.hours || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {clinic.workingHoursAr && clinic.workingHoursAr.length > 0 && (
                <div>
                  <table className="w-full text-sm" dir="rtl">
                    <tbody>
                      {clinic.workingHoursAr.map((h) => (
                        <tr key={h.day} className="border-b border-gray-100 last:border-0">
                          <td className="py-2 pl-4 font-medium text-gray-700 w-32">{h.day}</td>
                          <td className="py-2 text-gray-500">{h.hours || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Media */}
        {(clinic.logo || clinic.cardImage || clinic.coverImage || clinic.gallery?.length) ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Media</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {clinic.logo && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Logo</p>
                  <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                    <img src={clinic.logo} alt="" className="h-full w-full object-contain p-3" />
                  </div>
                </div>
              )}
              {clinic.cardImage && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Card Image</p>
                  <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                    <img src={clinic.cardImage} alt="" className="h-full w-full object-contain p-3" />
                  </div>
                </div>
              )}
              {clinic.coverImage && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Cover Image</p>
                  <div className="flex h-28 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                    <img src={clinic.coverImage} alt="" className="h-full w-full object-contain p-3" />
                  </div>
                </div>
              )}
            </div>
            {clinic.gallery && clinic.gallery.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Gallery ({clinic.gallery.length})</p>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {clinic.gallery.map((url, i) => (
                    <div key={url} className="flex h-20 items-center justify-center rounded-lg bg-gray-50 border border-gray-200">
                      <img src={url} alt={`Gallery ${i + 1}`} className="h-full w-full object-contain p-2" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Settings */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Settings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-gray-500">Accepts In-Person</span>
              <p className="text-sm mt-0.5">{clinic.acceptsInPerson !== false ? 'Yes' : 'No'}</p>
            </div>
            {clinic.redirectUrl && (
              <div>
                <span className="text-xs font-medium text-gray-500">Redirect URL</span>
                <p className="text-sm mt-0.5 text-blue-600 truncate">{clinic.redirectUrl}</p>
              </div>
            )}
          </div>
        </div>

        {/* Operations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Operations</h3>
          <div className="flex flex-wrap gap-3">
            {(clinic.status === 'inactive' || clinic.status === 'active') && (
              <button onClick={() => setShowArchive(true)} disabled={isActing}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Send className="h-4 w-4" /> Archive
              </button>
            )}
            {(clinic.status === 'inactive' || clinic.status === 'archived') && (
              <button onClick={handleDeleteClick} disabled={isActing}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium text-gray-500">Created</span><p className="mt-0.5 text-gray-900">{fmtDateTime(clinic.createdAt)}</p></div>
            <div><span className="font-medium text-gray-500">Updated</span><p className="mt-0.5 text-gray-900">{fmtDateTime(clinic.updatedAt)}</p></div>
            <div><span className="font-medium text-gray-500">Slug</span><p className="mt-0.5 text-gray-900 font-mono text-xs">{clinic.slug}</p></div>
            <div><span className="font-medium text-gray-500">ID</span><p className="mt-0.5 text-gray-900 font-mono text-xs">{clinic.id}</p></div>
          </div>
        </div>

        {/* Archive Modal */}
        {showArchive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Archive Clinic?</h3>
              <p className="text-sm text-gray-600 mb-5">This clinic will no longer be visible on the directory. All data is preserved.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowArchive(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={archive} disabled={isActing} className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                  {isActing ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDelete && deleteConsequences && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-semibold text-red-700 mb-3">Delete Clinic?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Type <strong>{deleteConsequences.slug}</strong> to confirm permanent deletion.
              </p>
              <input type="text" value={deleteSlug} onChange={(e) => setDeleteSlug(e.target.value)}
                placeholder={deleteConsequences.slug}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 mb-5" />
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDelete(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={handleDeleteConfirm} disabled={isActing || deleteSlug !== deleteConsequences.slug}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {isActing ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
