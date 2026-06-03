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
 * Implementation note: this script shells out to `mongosh` so it does not
 * need to import any Next.js / server-only modules. The same pattern is
 * used by `scripts/seed-admin.ts`.
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const candidate of ['../.env.local', '../.env']) {
  const resolvedPath = path.resolve(__dirname, candidate);
  if (fs.existsSync(resolvedPath)) {
    dotenv.config({ path: resolvedPath });
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Configure the admin env file first.');
  process.exit(1);
}

const MONGOSH_PATH =
  process.env.MONGOSH_PATH ||
  (process.platform === 'win32' ? 'C:\\mongosh\\bin\\mongosh.exe' : 'mongosh');

const ASSET_KEYS = ['logo', 'logoUrl', 'backgroundImage', 'faviconUrl'] as const;
const DEFAULT_FAVICON_VALUES = new Set(['/favicon.ico', '/default/favicon.ico']);

async function runMongoScript<T>(scriptBody: string): Promise<T> {
  try {
    const { stdout } = await execFileAsync(
      MONGOSH_PATH,
      [MONGODB_URI, '--quiet', '--eval', scriptBody],
      { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
    );

    const lastLine = stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();

    if (!lastLine) {
      throw new Error('Empty response from MongoDB.');
    }

    return JSON.parse(lastLine) as T;
  } catch (error) {
    // Re-throw without the embedded MongoDB URI (which would expose the
    // password in the error message and any logs that capture it).
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = message
      .replace(MONGODB_URI, '<mongodb-uri>')
      .replaceAll(MONGODB_URI.replace(/^mongodb:\/\/.*?@/, 'mongodb://'), '<mongodb-uri>');
    throw new Error(sanitized);
  }
}

interface TenantSummary {
  tenantId: string;
  slug: string;
}

interface RuntimeSummary {
  tenantSlug: string;
}

interface MigrationTrace {
  runtimeConfigId: string;
  tenantSlug: string;
  brandingSnapshot: Record<string, unknown> | null;
  changed: boolean;
  updateResult: { matchedCount: number; modifiedCount: number } | null;
  skippedReason?: string;
}

interface MigrationResult {
  tenantsUpdated: number;
  tenants: TenantSummary[];
  runtimeConfigsUpdated: number;
  runtimeConfigs: RuntimeSummary[];
  trace: MigrationTrace[];
}

function buildMigrationScript(): string {
  // The mongosh script walks every tenant, computes the new branding
  // object, and writes the changes back. Doing this in a single mongosh
  // roundtrip keeps the migration atomic-ish and avoids round-tripping
  // each document to Node.
  //
  // We also rewrite the matching runtimeConfigs documents. The
  // tenantapp serves the runtime config to end users, so any branding
  // URLs that point at the legacy static path need to be migrated
  // there too — otherwise the tenantapp browser still requests the
  // 404-bound path.
  return `
const assetKeys = ${JSON.stringify(ASSET_KEYS)};

function rewriteBranding(branding, slug) {
  if (!branding || !slug) {
    return { next: branding, changed: false };
  }
  const next = Object.assign({}, branding);
  let changed = false;
  const legacyBase = '/assets/tenants/' + slug + '/';
  const newBase = '/api/tenant-assets/' + slug + '/';
  for (const key of assetKeys) {
    const value = next[key];
    if (typeof value === 'string' && value.startsWith(legacyBase)) {
      next[key] = value.replace(legacyBase, newBase);
      changed = true;
    }
  }
  // If the stored faviconUrl is the bundled default, drop it so the
  // runtime falls back to the tenant logo. Tenants who uploaded a
  // dedicated favicon keep their override.
  if (typeof next.faviconUrl === 'string' && DEFAULT_FAVICON_VALUES.has(next.faviconUrl.trim())) {
    delete next.faviconUrl;
    changed = true;
  }
  return { next, changed };
}

const tenantSummary = [];
const tenants = db.tenants.find({}, { tenantId: 1, slug: 1, branding: 1 }).toArray();
for (const tenant of tenants) {
  const { next, changed } = rewriteBranding(tenant.branding, tenant.slug);
  if (!changed) {
    continue;
  }
  db.tenants.updateOne(
    { tenantId: tenant.tenantId },
    { $set: { branding: next, updatedAt: new Date().toISOString() } }
  );
  tenantSummary.push({ tenantId: tenant.tenantId, slug: tenant.slug });
}

const runtimeSummary = [];
const trace = [];
// Pull every runtime config along with its runtimeConfigId so each update
// is targeted at a single document. Using the branding object itself as
// part of the filter would skip rows when two configs share the same
// branding object, which is common after repeated publishes.
const runtimeConfigs = db.runtimeConfigs.find({}, { runtimeConfigId: 1, tenantSlug: 1, branding: 1, updatedAt: 1 }).toArray();
for (const runtimeConfig of runtimeConfigs) {
  const { next, changed } = rewriteBranding(runtimeConfig.branding, runtimeConfig.tenantSlug);
  if (!changed) {
    trace.push({
      runtimeConfigId: runtimeConfig.runtimeConfigId || '<missing>',
      tenantSlug: runtimeConfig.tenantSlug || '<missing>',
      brandingSnapshot: runtimeConfig.branding,
      changed: false,
      updateResult: null,
    });
    continue;
  }
  if (!runtimeConfig.runtimeConfigId) {
    trace.push({
      runtimeConfigId: '<missing>',
      tenantSlug: runtimeConfig.tenantSlug || '<missing>',
      brandingSnapshot: runtimeConfig.branding,
      changed: true,
      updateResult: null,
      skippedReason: 'missing runtimeConfigId',
    });
    continue;
  }
  const updateResult = db.runtimeConfigs.updateOne(
    { runtimeConfigId: runtimeConfig.runtimeConfigId },
    { $set: { branding: next, updatedAt: new Date().toISOString() } }
  );
  trace.push({
    runtimeConfigId: runtimeConfig.runtimeConfigId,
    tenantSlug: runtimeConfig.tenantSlug || '<missing>',
    brandingSnapshot: runtimeConfig.branding,
    changed: true,
    updateResult: {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    },
  });
  runtimeSummary.push({
    tenantSlug: runtimeConfig.tenantSlug,
    runtimeConfigId: runtimeConfig.runtimeConfigId,
  });
}

print(JSON.stringify({
  tenantsUpdated: tenantSummary.length,
  tenants: tenantSummary,
  runtimeConfigsUpdated: runtimeSummary.length,
  runtimeConfigs: runtimeSummary,
  trace,
}));
`;
}

async function main(): Promise<void> {
  console.log('Migrating tenant branding asset URLs...\n');
  console.log(`MONGODB_URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`MONGOSH_PATH: ${MONGOSH_PATH}\n`);

  const result = await runMongoScript<MigrationResult>(buildMigrationScript());

  if (result.tenantsUpdated === 0 && result.runtimeConfigsUpdated === 0) {
    console.log('No documents needed updating. (Either no legacy URLs were found, or no tenants exist.)');
  } else {
    if (result.tenantsUpdated > 0) {
      console.log(`Updated ${result.tenantsUpdated} tenant document(s):`);
      for (const tenant of result.tenants) {
        console.log(`  - ${tenant.slug} (${tenant.tenantId})`);
      }
    }
    if (result.runtimeConfigsUpdated > 0) {
      console.log(`\nUpdated ${result.runtimeConfigsUpdated} runtime config document(s):`);
      for (const runtime of result.runtimeConfigs) {
        console.log(`  - ${runtime.tenantSlug} (${runtime.runtimeConfigId})`);
      }
    }
  }

  // Always print the per-runtime-config trace so we can see why a
  // document was skipped or updated, even when nothing changed. This is
  // the single source of truth for "why did the migration not touch
  // the runtime configs I'm looking at?".
  if (result.trace && result.trace.length > 0) {
    console.log('\n--- runtime config trace ---');
    for (const entry of result.trace) {
      const status = entry.updateResult
        ? `updated (matched=${entry.updateResult.matchedCount}, modified=${entry.updateResult.modifiedCount})`
        : entry.changed
          ? `skipped: ${entry.skippedReason ?? 'unknown reason'}`
          : 'no change (branding already correct)';
      console.log(`  - ${entry.runtimeConfigId} [slug=${entry.tenantSlug}] -> ${status}`);
      if (entry.brandingSnapshot) {
        const brandingJson = JSON.stringify(entry.brandingSnapshot);
        console.log(`      branding: ${brandingJson.length > 200 ? brandingJson.slice(0, 200) + '...' : brandingJson}`);
      } else {
        console.log('      branding: <null>');
      }
    }
  }

  const markerPath = path.resolve(__dirname, '..', '.migrate-asset-urls.last-run');
  fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
