import 'server-only';

import type { BrandingConfig } from '@/types/branding';
import type {
  RuntimeAttributeTemplate,
  RuntimeScannerVersion,
  RuntimeVersionRefs,
  TenantRuntimeConfigSnapshot,
} from '@/types/runtime-config';
import { runMongoScript } from '../mongo-shell';

export interface TenantDocument {
  tenantId: string;
  name: string;
  slug: string;
  subdomain?: string;
  status: 'draft' | 'active' | 'disabled' | 'archived';
  branding?: BrandingConfig;
  activeRuntimeConfigId?: string | null;
  activeRuntimeConfigPublishedAt?: string | null;
  brandingVersionId?: string | null;
  draftScannerId?: string | null;
  draftAttributeTemplateId?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  plan?: string;
}

export interface RuntimeConfigDocument extends TenantRuntimeConfigSnapshot {
  tenantId: string;
  tenantSlug: string;
  tenantSubdomain?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  fingerprint?: string;
  brandingFingerprint?: string;
  sourceScannerId?: string | null;
  sourceScannerVersionId?: string | null;
  sourceAttributeTemplateId?: string | null;
}

export interface ScannerVersionDocument {
  scannerVersionId: string;
  tenantId: string;
  version: string;
  publishedAt: string;
  isActive: boolean;
  categories: RuntimeScannerVersion['categories'];
  followUpTriggers: RuntimeScannerVersion['followUpTriggers'];
  createdAt?: string;
  updatedAt?: string;
  sourceScannerId?: string | null;
  sourceScannerVersionId?: string | null;
  sourceFingerprint?: string | null;
  fingerprint?: string | null;
}

export interface AttributeTemplateVersionDocument {
  attributeTemplateVersionId: string;
  tenantId: string;
  version: string;
  publishedAt: string;
  isActive: boolean;
  attributeTemplate: RuntimeAttributeTemplate;
  createdAt?: string;
  updatedAt?: string;
  sourceAttributeTemplateId?: string | null;
  fingerprint?: string | null;
}

export interface TenantListData {
  tenants: TenantDocument[];
  runtimeConfigs: RuntimeConfigDocument[];
  tenantSubmissionCounts: Record<string, number>;
  runtimeSubmissionCounts: Record<string, number>;
}

export interface TenantDetailData extends TenantListData {
  tenant: TenantDocument | null;
  scannerVersions: ScannerVersionDocument[];
  attributeTemplateVersions: AttributeTemplateVersionDocument[];
}

let indexPromise: Promise<void> | null = null;

export async function ensureTenantModuleIndexes(): Promise<void> {
  if (!indexPromise) {
    indexPromise = runMongoScript<void>(`
const __stable = (value) => {
  if (Array.isArray(value)) {
    return '[' + value.map(__stable).join(',') + ']';
  }

  if (!value || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  return '{' + Object.keys(value)
    .sort()
    .map((key) => JSON.stringify(key) + ':' + __stable(value[key]))
    .join(',') + '}';
};

const __matchesIndexSpec = (index, key, options = {}) =>
  __stable(index.key) === __stable(key)
  && Boolean(index.unique) === Boolean(options.unique)
  && Boolean(index.sparse) === Boolean(options.sparse)
  && __stable(index.partialFilterExpression ?? null)
    === __stable(options.partialFilterExpression ?? null);

const __ensureIndex = (collectionName, key, options = {}) => {
  const collection = db.getCollection(collectionName);
  const existing = collection
    .getIndexes()
    .find((index) => __matchesIndexSpec(index, key, options));

  if (existing) {
    return existing.name;
  }

  return collection.createIndex(key, options);
};

const __dropIndexIfPresent = (collectionName, predicate) => {
  const collection = db.getCollection(collectionName);
  const index = collection.getIndexes().find(predicate);

  if (index && index.name !== '_id_') {
    collection.dropIndex(index.name);
  }
};

// Backfill legacy tenant identifier aliases before index management runs.
db.tenants.updateMany(
  {
    $or: [
      { tenantId: { $exists: false }, id: { $type: 'string' } },
      { id: { $exists: false }, tenantId: { $type: 'string' } },
      { id: null, tenantId: { $type: 'string' } },
    ],
  },
  [
    {
      $set: {
        tenantId: { $ifNull: ['$tenantId', '$id'] },
        id: { $ifNull: ['$id', '$tenantId'] },
      },
    },
  ],
);

// The current schema uses tenantId as the canonical key. Drop the old unique
// id index so inserts do not fail with dup key { id: null } on legacy databases.
__dropIndexIfPresent(
  'tenants',
  (index) =>
    index.name === 'id_1'
    || (
      __stable(index.key) === __stable({ id: 1 })
      && Boolean(index.unique)
    ),
);

__ensureIndex('tenants', { tenantId: 1 }, { unique: true, name: 'tenant_id_unique' });
__ensureIndex('tenants', { slug: 1 }, { unique: true, name: 'tenant_slug_unique' });
__ensureIndex(
  'tenants',
  { subdomain: 1 },
  {
    unique: true,
    sparse: true,
    name: 'tenant_subdomain_unique',
  },
);
__ensureIndex('tenants', { status: 1 }, { name: 'tenant_status_idx' });
__ensureIndex(
  'runtimeConfigs',
  { runtimeConfigId: 1 },
  { unique: true, name: 'runtime_config_id_unique' },
);
__ensureIndex(
  'runtimeConfigs',
  { tenantSlug: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'runtime_config_active_tenant_slug_unique',
  },
);
__ensureIndex(
  'runtimeConfigs',
  { tenantId: 1, publishedAt: -1 },
  { name: 'runtime_config_tenant_published' },
);
__ensureIndex(
  'runtimeConfigs',
  {
    tenantId: 1,
    'versionRefs.scannerVersionId': 1,
    'versionRefs.attributeTemplateVersionId': 1,
  },
  { name: 'runtime_config_version_tuple' },
);
__ensureIndex(
  'scannerVersions',
  { scannerVersionId: 1 },
  { unique: true, name: 'scanner_version_id_unique' },
);
__ensureIndex(
  'scannerVersions',
  { tenantId: 1, version: 1 },
  { unique: true, name: 'scanner_version_tenant_version_unique' },
);
__ensureIndex(
  'scannerVersions',
  { tenantId: 1, publishedAt: -1 },
  { name: 'scanner_version_tenant_published' },
);
__ensureIndex(
  'attributeTemplateVersions',
  { attributeTemplateVersionId: 1 },
  { unique: true, name: 'attribute_template_version_id_unique' },
);
__ensureIndex(
  'attributeTemplateVersions',
  { tenantId: 1, version: 1 },
  { unique: true, name: 'attribute_template_tenant_version_unique' },
);
__ensureIndex(
  'attributeTemplateVersions',
  { tenantId: 1, publishedAt: -1 },
  { name: 'attribute_template_tenant_published' },
);
__ensureIndex(
  'rawResponses',
  { tenantId: 1, runtimeConfigId: 1, submittedAt: -1 },
  { name: 'raw_response_tenant_runtime_config_submitted' },
);
__emit(null);
`, undefined, {
      label: 'tenant.ensure-indexes',
    }).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

export async function getTenantListData(): Promise<TenantListData> {
  return runMongoScript<TenantListData>(`
const tenants = db.tenants
  .find({}, { projection: { _id: 0 } })
  .sort({ updatedAt: -1, createdAt: -1, name: 1 })
  .toArray();

const runtimeConfigs = db.runtimeConfigs
  .find({}, { projection: { _id: 0 } })
  .sort({ publishedAt: -1, createdAt: -1 })
  .toArray();

const tenantSubmissionCounts = Object.fromEntries(
  db.rawResponses
    .aggregate([
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ])
    .toArray()
    .map((entry) => [entry._id, entry.count]),
);

const runtimeSubmissionCounts = Object.fromEntries(
  db.rawResponses
    .aggregate([
      { $group: { _id: '$runtimeConfigId', count: { $sum: 1 } } },
    ])
    .toArray()
    .map((entry) => [entry._id, entry.count]),
);

__emit({
  tenants: __strip(tenants),
  runtimeConfigs: __strip(runtimeConfigs),
  tenantSubmissionCounts,
  runtimeSubmissionCounts,
});
`);
}

export async function getTenantDetailData(
  tenantId: string,
): Promise<TenantDetailData> {
  return runMongoScript<TenantDetailData>(`
const tenant = db.tenants.findOne(
  { tenantId: __payload.tenantId },
  { projection: { _id: 0 } },
);

const runtimeConfigs = db.runtimeConfigs
  .find({ tenantId: __payload.tenantId }, { projection: { _id: 0 } })
  .sort({ publishedAt: -1, createdAt: -1 })
  .toArray();

const scannerVersions = db.scannerVersions
  .find({ tenantId: __payload.tenantId }, { projection: { _id: 0 } })
  .sort({ publishedAt: -1, createdAt: -1 })
  .toArray();

const attributeTemplateVersions = db.attributeTemplateVersions
  .find({ tenantId: __payload.tenantId }, { projection: { _id: 0 } })
  .sort({ publishedAt: -1, createdAt: -1 })
  .toArray();

const tenantSubmissionCounts = Object.fromEntries(
  db.rawResponses
    .aggregate([
      { $match: { tenantId: __payload.tenantId } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ])
    .toArray()
    .map((entry) => [entry._id, entry.count]),
);

const runtimeSubmissionCounts = Object.fromEntries(
  db.rawResponses
    .aggregate([
      { $match: { tenantId: __payload.tenantId } },
      { $group: { _id: '$runtimeConfigId', count: { $sum: 1 } } },
    ])
    .toArray()
    .map((entry) => [entry._id, entry.count]),
);

__emit({
  tenant: __strip(tenant),
  tenants: tenant ? [__strip(tenant)] : [],
  runtimeConfigs: __strip(runtimeConfigs),
  scannerVersions: __strip(scannerVersions),
  attributeTemplateVersions: __strip(attributeTemplateVersions),
  tenantSubmissionCounts,
  runtimeSubmissionCounts,
});
`, {
    tenantId,
  });
}

export async function getTenantDocumentBySlug(
  slug: string,
): Promise<TenantDocument | null> {
  return runMongoScript<TenantDocument | null>(`
const tenant = db.tenants.findOne(
  { slug: __payload.slug },
  { projection: { _id: 0 } },
);
__emit(__strip(tenant));
`, {
    slug,
  });
}

export async function getTenantDocumentById(
  tenantId: string,
): Promise<TenantDocument | null> {
  return runMongoScript<TenantDocument | null>(`
const tenant = db.tenants.findOne(
  { tenantId: __payload.tenantId },
  { projection: { _id: 0 } },
);
__emit(__strip(tenant));
`, {
    tenantId,
  });
}

export async function insertTenantDocument(
  tenant: TenantDocument,
): Promise<TenantDocument> {
  return runMongoScript<TenantDocument>(`
const tenantToInsert = {
  ...__payload.tenant,
  id: __payload.tenant.id ?? __payload.tenant.tenantId,
};

db.tenants.insertOne(tenantToInsert);
__emit(__strip(tenantToInsert));
`, {
    tenant,
  }, {
    label: 'tenant.insert-document',
  });
}

export async function updateTenantDocument(
  tenantId: string,
  updates: Partial<TenantDocument>,
): Promise<TenantDocument | null> {
  return runMongoScript<TenantDocument | null>(`
const updatedTenant = db.tenants.findOneAndUpdate(
  { tenantId: __payload.tenantId },
  { $set: __payload.updates },
  {
    returnDocument: 'after',
    projection: { _id: 0 },
  },
);

__emit(__strip(updatedTenant));
`, {
    tenantId,
    updates,
  }, {
    label: 'tenant.update-document',
  });
}

export async function activateRuntimeConfigForTenant(payload: {
  tenantId: string;
  runtimeConfigId: string;
  tenantStatus: TenantDocument['status'];
  activatedAt: string;
  updatedAt: string;
}): Promise<{
  tenant: TenantDocument | null;
  runtimeConfig: RuntimeConfigDocument | null;
}> {
  return runMongoScript(`
db.runtimeConfigs.updateMany(
  { tenantId: __payload.tenantId },
  {
    $set: {
      isActive: false,
      updatedAt: __payload.updatedAt,
    },
  },
);

db.runtimeConfigs.updateOne(
  {
    tenantId: __payload.tenantId,
    runtimeConfigId: __payload.runtimeConfigId,
  },
  {
    $set: {
      isActive: true,
      activatedAt: __payload.activatedAt,
      updatedAt: __payload.updatedAt,
    },
  },
);

const tenant = db.tenants.findOneAndUpdate(
  { tenantId: __payload.tenantId },
  {
    $set: {
      activeRuntimeConfigId: __payload.runtimeConfigId,
      activeRuntimeConfigPublishedAt: __payload.activatedAt,
      status: __payload.tenantStatus,
      updatedAt: __payload.updatedAt,
    },
  },
  {
    returnDocument: 'after',
    projection: { _id: 0 },
  },
);

const runtimeConfig = db.runtimeConfigs.findOne(
  {
    tenantId: __payload.tenantId,
    runtimeConfigId: __payload.runtimeConfigId,
  },
  { projection: { _id: 0 } },
);

__emit({
  tenant: __strip(tenant),
  runtimeConfig: __strip(runtimeConfig),
});
`, payload, {
  label: 'tenant.activate-runtime-config',
});
}

export async function publishTenantRuntimeDocuments(payload: {
  tenantId: string;
  tenantUpdates: Partial<TenantDocument>;
  runtimeConfig: RuntimeConfigDocument;
  scannerVersion: ScannerVersionDocument;
  attributeTemplateVersion: AttributeTemplateVersionDocument;
  activate: boolean;
}): Promise<{
  tenant: TenantDocument | null;
  runtimeConfig: RuntimeConfigDocument | null;
}> {
  return runMongoScript(`
const existingRuntime = db.runtimeConfigs.findOne(
  { runtimeConfigId: __payload.runtimeConfig.runtimeConfigId },
  { projection: { runtimeConfigId: 1 } },
);

if (existingRuntime) {
  throw new Error('Runtime config already exists.');
}

const existingScannerVersion = db.scannerVersions.findOne(
  { scannerVersionId: __payload.scannerVersion.scannerVersionId },
  { projection: { scannerVersionId: 1 } },
);

if (!existingScannerVersion) {
  db.scannerVersions.insertOne(__payload.scannerVersion);
}

const existingAttributeTemplateVersion = db.attributeTemplateVersions.findOne(
  { attributeTemplateVersionId: __payload.attributeTemplateVersion.attributeTemplateVersionId },
  { projection: { attributeTemplateVersionId: 1 } },
);

if (!existingAttributeTemplateVersion) {
  db.attributeTemplateVersions.insertOne(__payload.attributeTemplateVersion);
}

if (__payload.activate) {
  db.runtimeConfigs.updateMany(
    { tenantId: __payload.tenantId },
    {
      $set: {
        isActive: false,
        updatedAt: __payload.runtimeConfig.updatedAt,
      },
    },
  );
}

db.runtimeConfigs.insertOne(__payload.runtimeConfig);

const tenant = db.tenants.findOneAndUpdate(
  { tenantId: __payload.tenantId },
  { $set: __payload.tenantUpdates },
  {
    returnDocument: 'after',
    projection: { _id: 0 },
  },
);

const runtimeConfig = db.runtimeConfigs.findOne(
  { runtimeConfigId: __payload.runtimeConfig.runtimeConfigId },
  { projection: { _id: 0 } },
);

__emit({
  tenant: __strip(tenant),
  runtimeConfig: __strip(runtimeConfig),
});
`, payload, {
  label: 'tenant.publish-runtime-documents',
});
}

export async function deleteTenantDocument(
  tenantId: string,
): Promise<void> {
  await runMongoScript<void>(`
db.tenants.deleteOne({ tenantId: __payload.tenantId });
__emit(null);
`, {
    tenantId,
  });
}
