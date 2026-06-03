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
  branding: Record<string, unknown> | null;
}

function buildMigrationScript(): string {
  // The mongosh script walks every tenant, computes the new branding
  // object, and writes the changes back. Doing this in a single mongosh
  // roundtrip keeps the migration atomic-ish and avoids round-tripping
  // each document to Node.
  return `
const tenants = db.tenants.find({}, { projection: { tenantId: 1, slug: 1, branding: 1 } }).toArray();
const assetKeys = ${JSON.stringify(ASSET_KEYS)};
const summary = [];
for (const tenant of tenants) {
  if (!tenant.slug || !tenant.branding) {
    continue;
  }
  const next = Object.assign({}, tenant.branding);
  let changed = false;
  const legacyBase = '/assets/tenants/' + tenant.slug + '/';
  const newBase = '/api/tenant-assets/' + tenant.slug + '/';
  for (const key of assetKeys) {
    const value = next[key];
    if (typeof value === 'string' && value.startsWith(legacyBase)) {
      next[key] = value.replace(legacyBase, newBase);
      changed = true;
    }
  }
  if (changed) {
    db.tenants.updateOne(
      { tenantId: tenant.tenantId },
      { $set: { branding: next, updatedAt: new Date().toISOString() } }
    );
    summary.push({ tenantId: tenant.tenantId, slug: tenant.slug });
  }
}
print(JSON.stringify({ updated: summary.length, tenants: summary }));
`;
}

async function main(): Promise<void> {
  console.log('Migrating tenant branding asset URLs...\n');
  console.log(`MONGODB_URI: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);
  console.log(`MONGOSH_PATH: ${MONGOSH_PATH}\n`);

  const result = await runMongoScript<{
    updated: number;
    tenants: Array<{ tenantId: string; slug: string }>;
  }>(buildMigrationScript());

  if (result.updated === 0) {
    console.log('No tenants needed updating. (Either no legacy URLs were found, or no tenants exist.)');
  } else {
    console.log(`Updated ${result.updated} tenant(s):`);
    for (const tenant of result.tenants) {
      console.log(`  - ${tenant.slug} (${tenant.tenantId})`);
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
