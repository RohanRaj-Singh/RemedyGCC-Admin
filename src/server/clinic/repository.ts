import 'server-only';

import { runMongoScript } from '../mongo-shell';

export interface ClinicDocument {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  cardImage?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  gallery?: string[] | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  addressAr?: string | null;
  coordinates?: { lat: number | null; lng: number | null } | null;
  googleMapsUrl?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  workingHours?: { day: string; hours: string }[] | null;
  workingHoursAr?: { day: string; hours: string }[] | null;
  acceptsInPerson?: boolean;
  redirectUrl?: string | null;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface ClinicListData {
  clinics: ClinicDocument[];
}

let indexPromise: Promise<void> | null = null;

const ENSURE_INDEXES_SCRIPT = `
// Create each index. createIndex() auto-creates the collection and is
// idempotent — calling it again with the same key+options is a no-op.
db.clinics.createIndex({ id: 1 }, { unique: true, name: 'clinic_id_unique' });
db.clinics.createIndex({ slug: 1 }, { unique: true, name: 'clinic_slug_unique' });
db.clinics.createIndex({ status: 1 }, { name: 'clinic_status_idx' });
__emit(null);
`;

export async function ensureClinicModuleIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(ENSURE_INDEXES_SCRIPT, undefined, {
      label: 'clinic.ensure-indexes',
    }).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  await indexPromise;
}

export async function getClinicListData(): Promise<ClinicListData> {
  return runMongoScript<ClinicListData>(`
    const clinics = db.clinics
      .find({}, { projection: { _id: 0 } })
      .sort({ updatedAt: -1, createdAt: -1, name: 1 })
      .toArray();

    __emit({ clinics: __strip(clinics) });
  `);
}

export async function getClinicDocumentById(
  clinicId: string,
): Promise<ClinicDocument | null> {
  return runMongoScript<ClinicDocument | null>(`
    const clinic = db.clinics.findOne(
      { id: __payload.clinicId },
      { projection: { _id: 0 } },
    );
    __emit(__strip(clinic));
  `, { clinicId });
}

export async function getClinicDocumentBySlug(
  slug: string,
): Promise<ClinicDocument | null> {
  return runMongoScript<ClinicDocument | null>(`
    const clinic = db.clinics.findOne(
      { slug: __payload.slug },
      { projection: { _id: 0 } },
    );
    __emit(__strip(clinic));
  `, { slug });
}

export async function insertClinicDocument(
  clinic: ClinicDocument,
): Promise<ClinicDocument> {
  return runMongoScript<ClinicDocument>(`
    const doc = { ...__payload.clinic };

    if (!doc.id && doc.clinicId) {
      doc.id = doc.clinicId;
    }

    db.clinics.insertOne(doc);
    __emit(__strip(doc));
  `, { clinic }, { label: 'clinic.insert-document' });
}

export async function updateClinicDocument(
  clinicId: string,
  updates: Partial<ClinicDocument>,
): Promise<ClinicDocument | null> {
  return runMongoScript<ClinicDocument | null>(`
    const updated = db.clinics.findOneAndUpdate(
      { id: __payload.clinicId },
      { $set: __payload.updates },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    __emit(__strip(updated));
  `, { clinicId, updates }, { label: 'clinic.update-document' });
}

export async function deleteClinicDocument(
  clinicId: string,
): Promise<void> {
  await runMongoScript<void>(`
    db.clinics.deleteOne({ id: __payload.clinicId });
    __emit(null);
  `, { clinicId });
}
