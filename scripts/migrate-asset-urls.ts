/**
 * One-shot migration: rewrite every stored tenant branding URL of the form
 *
 *   /assets/tenants/<slug>/...
 *
 * to
 *
 *   /api/tenant-assets/<slug>/...
 *
 * so that production requests hit the dynamic route handler instead of the
 * Next.js static manifest (which 404s for files added after `next build`).
 *
 * Run from the admin project root:
 *
 *   npm run migrate:asset-urls
 *
 * The script is idempotent — running it twice does not change anything on
 * the second pass.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { runMongoScript } from '../src/server/mongo-shell';
import { normalizeTenantSlugInput, validateTenantSlug } from '../src/modules/tenant/utils';

interface TenantDocument {
  tenantId: string;
  slug: string;
  branding?: Record<string, unknown> | null;
}

interface BrandingFields {
  logo?: unknown;
  logoUrl?: unknown;
  backgroundImage?: unknown;
  faviconUrl?: unknown;
}

const ASSET_KEYS: Array<keyof BrandingFields> = ['logo', 'logoUrl', 'backgroundImage', 'faviconUrl'];

function migrateUrl(value: unknown, slug: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const legacyPrefix = `/assets/tenants/${slug}/`;
  if (value.startsWith(legacyPrefix)) {
    return value.replace(legacyPrefix, `/api/tenant-assets/${slug}/`);
  }
  return value;
}

function migrateBranding(branding: BrandingFields | null | undefined, slug: string): {
  changed: boolean;
  next: BrandingFields;
} {
  if (!branding) {
    return { changed: false, next: branding ?? {} };
  }

  const next: BrandingFields = { ...branding };
  let changed = false;
  for (const key of ASSET_KEYS) {
    const migrated = migrateUrl(branding[key], slug);
    if (migrated !== branding[key]) {
      next[key] = migrated as never;
      changed = true;
    }
  }
  return { changed, next };
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set. Configure the admin env file first.');
  }

  // Validate slug utility imports resolved.
  normalizeTenantSlugInput('test');
  validateTenantSlug('test');

  const tenants = await runMongoScript<TenantDocument[]>(`
const docs = db.tenants.find({}, { projection: { _id: 0, tenantId: 1, slug: 1, branding: 1 } }).toArray();
__emit(__strip(docs));
`, {});

  if (!tenants || tenants.length === 0) {
    console.log('No tenants found. Nothing to migrate.');
    return;
  }

  let updatedCount = 0;
  for (const tenant of tenants) {
    if (!tenant.slug) {
      continue;
    }
    const { changed, next } = migrateBranding(tenant.branding as BrandingFields | null, tenant.slug);
    if (!changed) {
      continue;
    }

    await runMongoScript(`
db.tenants.updateOne(
  { tenantId: __payload.tenantId },
  { $set: { branding: __payload.branding, updatedAt: new Date().toISOString() } }
);
__emit({ ok: 1 });
`, {
      tenantId: tenant.tenantId,
      branding: next,
    });

    updatedCount += 1;
    console.log(`Updated tenant ${tenant.slug} (${tenant.tenantId})`);
  }

  console.log(`\nDone. Updated ${updatedCount} tenant(s).`);

  // Also drop a marker so we know the migration ran.
  const markerPath = path.resolve(process.cwd(), '.migrate-asset-urls.last-run');
  await fs.writeFile(markerPath, new Date().toISOString(), 'utf8');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
