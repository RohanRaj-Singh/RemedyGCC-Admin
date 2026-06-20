'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Clinic, ClinicStatus, WorkingHoursEntry } from '../types';
import { getClinicStatusMeta, normalizeClinicSlugInput, validateClinicSlug } from '../utils';
import { clinicService } from '@/services/clinic-service';
import { ClinicMediaUploader } from './ClinicMediaUploader';

interface ClinicFormProps {
  clinic?: Clinic | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

const DEFAULT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function emptyHours(days: string[]): WorkingHoursEntry[] {
  return days.map((day) => ({ day, hours: '' }));
}

export function ClinicForm({ clinic, onSubmit, onCancel, isLoading, error }: ClinicFormProps) {
  const isEditing = Boolean(clinic);
  const isArchived = clinic?.status === 'archived';

  // Identity
  const [name, setName] = useState(clinic?.name || '');
  const [nameAr, setNameAr] = useState(clinic?.nameAr || '');
  const [slug, setSlug] = useState(clinic?.slug || '');
  const [slugTouched, setSlugTouched] = useState(Boolean(clinic?.slug));
  const [slugManual, setSlugManual] = useState(Boolean(clinic?.slug));
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Contact
  const [phone, setPhone] = useState(clinic?.phone || '');
  const [email, setEmail] = useState(clinic?.email || '');
  const [website, setWebsite] = useState(clinic?.website || '');

  // Location
  const [address, setAddress] = useState(clinic?.address || '');
  const [addressAr, setAddressAr] = useState(clinic?.addressAr || '');
  const [lat, setLat] = useState(clinic?.coordinates?.lat?.toString() || '');
  const [lng, setLng] = useState(clinic?.coordinates?.lng?.toString() || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(clinic?.googleMapsUrl || '');

  // Description
  const [description, setDescription] = useState(clinic?.description || '');
  const [descriptionAr, setDescriptionAr] = useState(clinic?.descriptionAr || '');

  // Working hours
  const [workingHours, setWorkingHours] = useState<WorkingHoursEntry[]>(
    clinic?.workingHours || emptyHours(DEFAULT_DAYS),
  );
  const [workingHoursAr, setWorkingHoursAr] = useState<WorkingHoursEntry[]>(
    clinic?.workingHoursAr || emptyHours(DEFAULT_DAYS_AR),
  );

  // Media
  const [cardImage, setCardImage] = useState(clinic?.cardImage || null);
  const [logo, setLogo] = useState(clinic?.logo || null);
  const [coverImage, setCoverImage] = useState(clinic?.coverImage || null);
  const [gallery, setGallery] = useState<string[]>(clinic?.gallery || []);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Settings
  const [acceptsInPerson, setAcceptsInPerson] = useState(clinic?.acceptsInPerson ?? true);
  const [redirectUrl, setRedirectUrl] = useState(clinic?.redirectUrl || '');

  const [formError, setFormError] = useState('');
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Slug auto-generation
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (!slugTouched && !slugManual && !isEditing) {
      const generated = normalizeClinicSlugInput(value);
      setSlug(generated);
      if (generated.length >= 2) checkSlug(generated);
    }
  }, [slugTouched, slugManual, isEditing]);

  const handleSlugChange = useCallback((value: string) => {
    setSlugTouched(true);
    setSlugManual(true);
    const normalized = normalizeClinicSlugInput(value);
    setSlug(normalized);
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    if (normalized.length >= 2) {
      checkTimeoutRef.current = setTimeout(() => checkSlug(normalized), 400);
    } else {
      setSlugStatus('idle');
    }
  }, []);

  const checkSlug = async (value: string) => {
    const v = validateClinicSlug(value);
    if (v.errors.length > 0) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    try {
      const { data } = await clinicService.checkSlugAvailability(value);
      setSlugStatus(data?.available ? 'available' : 'taken');
    } catch { setSlugStatus('idle'); }
  };

  // Media uploads
  const handleLogoUpload = useCallback(async (file: File) => {
    if (!clinic) throw new Error('Save the clinic first before uploading images.');
    setUploadingLogo(true);
    try {
      const { data } = await clinicService.uploadAssets(
        { clinicId: clinic.id, clinicSlug: clinic.slug }, { logo: file },
      );
      if (data?.logo) setLogo(data.logo);
    } finally { setUploadingLogo(false); }
  }, [clinic]);

  const handleCardUpload = useCallback(async (file: File) => {
    if (!clinic) throw new Error('Save the clinic first before uploading images.');
    setUploadingCard(true);
    try {
      const { data } = await clinicService.uploadAssets(
        { clinicId: clinic.id, clinicSlug: clinic.slug }, { logo: file },
      );
      if (data?.logo) setCardImage(data.logo);
    } finally { setUploadingCard(false); }
  }, [clinic]);

  const handleCoverUpload = useCallback(async (file: File) => {
    if (!clinic) throw new Error('Save the clinic first before uploading images.');
    setUploadingCover(true);
    try {
      const { data } = await clinicService.uploadAssets(
        { clinicId: clinic.id, clinicSlug: clinic.slug }, { coverImage: file },
      );
      if (data?.coverImage) setCoverImage(data.coverImage);
    } finally { setUploadingCover(false); }
  }, [clinic]);

  const handleGalleryUpload = useCallback(async (file: File) => {
    if (!clinic) throw new Error('Save the clinic first before uploading images.');
    setUploadingGallery(true);
    try {
      const { data } = await clinicService.uploadAssets(
        { clinicId: clinic.id, clinicSlug: clinic.slug }, { gallery: file },
      );
      if (data?.galleryImage) setGallery((prev) => [...prev, data.galleryImage!]);
    } finally { setUploadingGallery(false); }
  }, [clinic]);

  const removeGalleryImage = (url: string) => {
    setGallery((prev) => prev.filter((u) => u !== url));
  };

  // Working hours editor helpers
  const updateHours = (index: number, value: string, lang: 'en' | 'ar') => {
    if (lang === 'en') {
      setWorkingHours((prev) => prev.map((h, i) => i === index ? { ...h, hours: value } : h));
    } else {
      setWorkingHoursAr((prev) => prev.map((h, i) => i === index ? { ...h, hours: value } : h));
    }
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) { setFormError('Clinic name is required.'); return; }

    const slugValidation = validateClinicSlug(slug);
    if (slugValidation.errors.length > 0) { setFormError(slugValidation.errors[0]); return; }

    const coords = (lat || lng)
      ? { lat: lat ? parseFloat(lat) : null, lng: lng ? parseFloat(lng) : null }
      : null;

    onSubmit({
      name: name.trim(),
      nameAr: nameAr.trim() || null,
      slug: slugValidation.normalized,
      cardImage,
      logo,
      coverImage,
      gallery: gallery.length > 0 ? gallery : null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      addressAr: addressAr.trim() || null,
      coordinates: coords,
      googleMapsUrl: googleMapsUrl.trim() || null,
      description: description.trim() || null,
      descriptionAr: descriptionAr.trim() || null,
      workingHours: workingHours.some((h) => h.hours.trim()) ? workingHours : null,
      workingHoursAr: workingHoursAr.some((h) => h.hours.trim()) ? workingHoursAr : null,
      acceptsInPerson,
      redirectUrl: redirectUrl.trim() || null,
    });
  };

  const displayError = error || formError;

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors disabled:bg-gray-100 disabled:text-gray-500';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-6';
  const sectionTitleClass = 'text-lg font-semibold text-gray-900';
  const sectionDescClass = 'mt-1 text-sm text-gray-500';
  const fieldErrorClass = 'rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {displayError && <div className={fieldErrorClass}>{displayError}</div>}

      {isArchived && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Archived clinics cannot be modified. Restore the clinic to make changes.
        </div>
      )}

      {/* ===== SECTION: Basic Info ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Basic Information</h2>
        <p className={sectionDescClass}>Clinic name and URL identifier.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Clinic Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => handleNameChange(e.target.value)}
              disabled={isArchived} required placeholder="e.g., Eunoia Clinic" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Clinic Name (Arabic)</label>
            <input type="text" dir="rtl" value={nameAr} onChange={(e) => setNameAr(e.target.value)}
              disabled={isArchived} placeholder="e.g., عيادة يونويا" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Slug <span className="text-red-500">*</span></label>
            <input type="text" value={slug} onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isArchived} required placeholder="e.g., eunoia-clinic"
              className={`${inputClass} ${slugStatus === 'taken' ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`} />
            <p className="mt-1 text-xs text-gray-500">
              /clinics/{slug || 'slug'}
              {slugStatus === 'checking' && <span className="text-blue-600"> — Checking...</span>}
              {slugStatus === 'taken' && <span className="text-red-600"> — Already in use</span>}
              {slugStatus === 'available' && <span className="text-green-600"> — Available</span>}
            </p>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <div className="mt-2">
              {clinic ? (
                <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium
                  ${clinic.status === 'active' ? 'bg-green-100 text-green-700' :
                    clinic.status === 'inactive' ? 'bg-gray-100 text-gray-600' :
                    'bg-gray-100 text-gray-500'}`}>
                  {getClinicStatusMeta(clinic.status).label}
                </span>
              ) : (
                <span className="text-sm text-gray-500">New clinics start as inactive.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION: Contact ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Contact</h2>
        <p className={sectionDescClass}>Phone, email, and website for the clinic.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div>
            <label className={labelClass}>Phone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
              disabled={isArchived} placeholder="+968 24121188" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              disabled={isArchived} placeholder="info@clinic.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Website</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)}
              disabled={isArchived} placeholder="https://clinic.com" className={inputClass} />
          </div>
        </div>
      </section>

      {/* ===== SECTION: Location ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Location</h2>
        <p className={sectionDescClass}>Physical address and map coordinates.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                disabled={isArchived} rows={2} placeholder="First Tower - 2nd Floor..." className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Address (Arabic)</label>
              <textarea dir="rtl" value={addressAr} onChange={(e) => setAddressAr(e.target.value)}
                disabled={isArchived} rows={2} placeholder="البرج الأول - الطابق الثاني..." className={inputClass} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Latitude</label>
                <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)}
                  disabled={isArchived} placeholder="23.600" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Longitude</label>
                <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)}
                  disabled={isArchived} placeholder="58.350" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Google Maps URL</label>
              <input type="url" value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
                disabled={isArchived} placeholder="https://maps.app.goo.gl/..." className={inputClass} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION: Description ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Description</h2>
        <p className={sectionDescClass}>Clinic description shown on the directory.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              disabled={isArchived} rows={4} placeholder="About the clinic..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description (Arabic)</label>
            <textarea dir="rtl" value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)}
              disabled={isArchived} rows={4} placeholder="نبذة عن العيادة..." className={inputClass} />
          </div>
        </div>
      </section>

      {/* ===== SECTION: Working Hours ===== */}
      <section className={sectionClass}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={sectionTitleClass}>Working Hours</h2>
            <p className={sectionDescClass}>Regular opening hours for the clinic.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">English</h3>
            <div className="space-y-1.5">
              {workingHours.map((entry, i) => (
                <div key={entry.day} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs font-medium text-gray-600">{entry.day}</span>
                  <input type="text" value={entry.hours}
                    onChange={(e) => updateHours(i, e.target.value, 'en')}
                    disabled={isArchived}
                    placeholder="9:00 AM - 6:00 PM"
                    className={`${inputClass} text-xs`} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Arabic</h3>
            <div className="space-y-1.5">
              {workingHoursAr.map((entry, i) => (
                <div key={entry.day} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs font-medium text-gray-600" dir="rtl">{entry.day}</span>
                  <input type="text" dir="rtl" value={entry.hours}
                    onChange={(e) => updateHours(i, e.target.value, 'ar')}
                    disabled={isArchived}
                    placeholder="٩:٠٠ صباحاً - ٦:٠٠ مساءً"
                    className={`${inputClass} text-xs`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION: Media ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Media</h2>
        <p className={sectionDescClass}>Images for the clinic directory listing.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <ClinicMediaUploader label="Logo" currentUrl={logo} uploading={uploadingLogo}
            onUpload={handleLogoUpload}
            onRemove={isEditing && !isArchived ? () => setLogo(null) : undefined} />
          <ClinicMediaUploader label="Card Image" currentUrl={cardImage} uploading={uploadingCard}
            onUpload={handleCardUpload}
            onRemove={isEditing && !isArchived ? () => setCardImage(null) : undefined} />
          <ClinicMediaUploader label="Cover Image" currentUrl={coverImage} uploading={uploadingCover}
            onUpload={handleCoverUpload}
            onRemove={isEditing && !isArchived ? () => setCoverImage(null) : undefined} />
        </div>

        {/* Gallery */}
        <div className="mt-5">
          <label className={labelClass}>Gallery Images</label>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
            {gallery.map((url, i) => (
              <div key={url} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Gallery ${i + 1}`} className="h-24 w-full object-contain p-2" />
                {isEditing && !isArchived && (
                  <button type="button" onClick={() => removeGalleryImage(url)}
                    className="absolute right-1 top-1 rounded bg-white/80 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3 text-red-500" />
                  </button>
                )}
              </div>
            ))}
            {isEditing && !isArchived && (
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
                {uploadingGallery ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                ) : (
                  <Plus className="h-5 w-5 text-gray-400" />
                )}
                <span className="mt-1 text-xs text-gray-500">Add image</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(f); }}
                  disabled={uploadingGallery} />
              </label>
            )}
          </div>
          {!isEditing && (
            <p className="mt-2 text-xs text-gray-500">Save the clinic first, then upload images.</p>
          )}
        </div>
      </section>

      {/* ===== SECTION: Settings ===== */}
      <section className={sectionClass}>
        <h2 className={sectionTitleClass}>Settings</h2>
        <p className={sectionDescClass}>Additional clinic configuration.</p>
        <div className="mt-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={acceptsInPerson}
              onChange={(e) => setAcceptsInPerson(e.target.checked)}
              disabled={isArchived}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <div>
              <span className="text-sm font-medium text-gray-900">Accepts in-person visits</span>
              <p className="text-xs text-gray-500">Uncheck if the clinic is online-only.</p>
            </div>
          </label>

          <div>
            <label className={labelClass}>Redirect URL (optional)</label>
            <input type="url" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)}
              disabled={isArchived}
              placeholder="https://clinic-website.com"
              className={`${inputClass} max-w-lg`} />
            <p className="mt-1 text-xs text-gray-500">
              If set, clicking this clinic on the directory will redirect to this URL instead of the detail page.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Actions ===== */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
        <button type="button" onClick={onCancel} disabled={isLoading}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isLoading || isArchived}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {isLoading ? 'Saving...' : clinic ? 'Save Changes' : 'Create Clinic'}
        </button>
      </div>
    </form>
  );
}
