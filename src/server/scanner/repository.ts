import 'server-only';

import type {
  Scanner,
  ScannerVersion,
  ScannerDetail,
  ScannerVersionSummary,
} from '@/modules/scanner/types';
import { runMongoScript } from '../mongo-shell';

// To match existing structure, we need types representing what's stored in Mongo.
export type ScannerDocument = Omit<Scanner, 'draftVersionId' | 'publishedVersionId'> & {
  versions: ScannerVersionDocument[];
};

export type ScannerVersionDocument = ScannerVersion;

interface ScannerListFilters {
  publishedOnly?: boolean;
}

let indexPromise: Promise<void> | null = null;

export async function ensureScannerModuleIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(`
const __ensureIndex = (collectionName, key, options = {}) => {
  const collection = db.getCollection(collectionName);
  let existing;
  try {
    existing = collection
      .getIndexes()
      .find((index) => {
        return JSON.stringify(index.key) === JSON.stringify(key);
      });
  } catch (e) {
    existing = null;
  }

  if (existing) {
    return existing.name;
  }

  return collection.createIndex(key, options);
};

__ensureIndex('scanners', { id: 1 }, { unique: true, name: 'admin_scanner_id_unique' });
__ensureIndex('adminScannerVersions', { id: 1 }, { unique: true, name: 'admin_scanner_version_id_unique' });
__ensureIndex('adminScannerVersions', { scannerId: 1, versionNumber: 1 }, { unique: true, name: 'admin_scanner_version_number_unique' });

__emit(null);
`).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

export async function getScannersListData(
  filters: ScannerListFilters = {},
): Promise<ScannerDocument[]> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument[]>(`
const scannerQuery = __payload.publishedOnly ? { status: 'published' } : {};
const scanners = db.scanners.find(scannerQuery, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();

const result = scanners.map(scanner => {
  const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).toArray();
  return { ...scanner, versions };
});

__emit(__strip(result));
`, { publishedOnly: filters.publishedOnly ?? false });
}

export async function getScannerDetailData(scannerId: string): Promise<ScannerDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument | null>(`
const scanner = db.scanners.findOne({ id: __payload.scannerId }, { projection: { _id: 0 } });
if (!scanner) {
  __emit(null);
  return;
}

const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).sort({ versionNumber: -1 }).toArray();

__emit(__strip({ ...scanner, versions }));
`, { scannerId });
}

export async function insertScannerDocument(
  scanner: Omit<ScannerDocument, 'versions'>,
  draftVersion: ScannerVersionDocument
): Promise<ScannerDocument> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument>(`
db.scanners.insertOne(__payload.scanner);
db.adminScannerVersions.insertOne(__payload.draftVersion);

__emit(__strip({
  ...__payload.scanner,
  versions: [__payload.draftVersion]
}));
`, { scanner, draftVersion });
}

export async function updateScannerDraftDocument(
  scannerId: string,
  draftVersionId: string,
  scannerUpdates: Partial<Omit<ScannerDocument, 'versions'>>,
  versionUpdates: Partial<ScannerVersionDocument>
): Promise<ScannerDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument | null>(`
db.scanners.updateOne(
  { id: __payload.scannerId },
  { $set: __payload.scannerUpdates }
);

db.adminScannerVersions.updateOne(
  { id: __payload.draftVersionId, scannerId: __payload.scannerId, status: 'draft' },
  { $set: __payload.versionUpdates }
);

const scanner = db.scanners.findOne({ id: __payload.scannerId }, { projection: { _id: 0 } });
if (!scanner) {
  __emit(null);
  return;
}

const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).sort({ versionNumber: -1 }).toArray();

__emit(__strip({ ...scanner, versions }));
`, { scannerId, draftVersionId, scannerUpdates, versionUpdates });
}

export async function publishScannerVersionDocument(
  scannerId: string,
  draftVersionId: string,
  publishedAt: string
): Promise<ScannerDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument | null>(`
db.adminScannerVersions.updateOne(
  { id: __payload.draftVersionId, scannerId: __payload.scannerId, status: 'draft' },
  { 
    $set: { 
      status: 'published', 
      publishedAt: __payload.publishedAt,
      updatedAt: __payload.publishedAt
    } 
  }
);

db.scanners.updateOne(
  { id: __payload.scannerId },
  { 
    $set: { 
      status: 'published',
      updatedAt: __payload.publishedAt
    }
  }
);

const scanner = db.scanners.findOne({ id: __payload.scannerId }, { projection: { _id: 0 } });
if (!scanner) {
  __emit(null);
  return;
}

const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).sort({ versionNumber: -1 }).toArray();

__emit(__strip({ ...scanner, versions }));
`, { scannerId, draftVersionId, publishedAt });
}

export async function archiveScannerDocument(scannerId: string): Promise<ScannerDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument | null>(`
const now = new Date().toISOString();
db.scanners.updateOne(
  { id: __payload.scannerId },
  { 
    $set: { 
      status: 'archived',
      updatedAt: now
    }
  }
);

const scanner = db.scanners.findOne({ id: __payload.scannerId }, { projection: { _id: 0 } });
if (!scanner) {
  __emit(null);
  return;
}

const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).sort({ versionNumber: -1 }).toArray();

__emit(__strip({ ...scanner, versions }));
`, { scannerId });
}

export async function createNewDraftVersionDocument(
  scannerId: string,
  newDraftVersion: ScannerVersionDocument
): Promise<ScannerDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerDocument | null>(`
db.adminScannerVersions.insertOne(__payload.newDraftVersion);

db.scanners.updateOne(
  { id: __payload.scannerId },
  { $set: { updatedAt: __payload.newDraftVersion.updatedAt } }
);

const scanner = db.scanners.findOne({ id: __payload.scannerId }, { projection: { _id: 0 } });
if (!scanner) {
  __emit(null);
  return;
}

const versions = db.adminScannerVersions.find({ scannerId: scanner.id }, { projection: { _id: 0 } }).sort({ versionNumber: -1 }).toArray();

__emit(__strip({ ...scanner, versions }));
`, { scannerId, newDraftVersion });
}

export async function getScannerVersionById(
  versionId: string,
): Promise<ScannerVersionDocument | null> {
  await ensureScannerModuleIndexes();
  return runMongoScript<ScannerVersionDocument | null>(`
const version = db.adminScannerVersions.findOne({ id: __payload.versionId }, { projection: { _id: 0 } });

if (!version) {
  __emit(null);
  return;
}

__emit(__strip(version));
`, { versionId });
}
