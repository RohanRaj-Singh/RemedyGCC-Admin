/**
 * Read-only diagnostic: dumps the branding records for one or more tenants
 * from both `db.tenants` and `db.runtimeConfigs` so we can see what URLs
 * are actually stored and confirm whether the migration succeeded.
 *
 * Usage:
 *   npx tsx scripts/diag-tenant-assets.ts omantel
 *   npx tsx scripts/diag-tenant-assets.ts omantel acme beau
 *
 * If no slugs are passed, lists every tenant with a non-empty branding
 * record.
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

const slugs = process.argv.slice(2).filter(Boolean);

function buildScript(): string {
  const slugsJson = JSON.stringify(slugs);
  return `
const slugs = ${slugsJson};
const filter = slugs.length > 0 ? { slug: { $in: slugs } } : {};
const tenantFilter = slugs.length > 0 ? { slug: { $in: slugs } } : {};
const runtimeFilter = slugs.length > 0 ? { tenantSlug: { $in: slugs } } : {};

print('--- tenant records ---');
db.tenants.find(tenantFilter, { _id: 0, tenantId: 1, slug: 1, branding: 1 }).forEach(t => {
  print(JSON.stringify(t, null, 2));
});

print('\\n--- runtimeConfigs ---');
db.runtimeConfigs.find(runtimeFilter, { _id: 0, runtimeConfigId: 1, tenantSlug: 1, isActive: 1, branding: 1, updatedAt: 1 }).forEach(rc => {
  print(JSON.stringify(rc, null, 2));
});

print('\\n--- legacy /assets/tenants/ counts ---');
const legacyPattern = '/assets/tenants/';
const tenantLegacy = db.tenants.countDocuments(Object.assign({}, filter, {
  $or: [
    { 'branding.logo': { $regex: legacyPattern } },
    { 'branding.logoUrl': { $regex: legacyPattern } },
    { 'branding.backgroundImage': { $regex: legacyPattern } },
    { 'branding.faviconUrl': { $regex: legacyPattern } },
  ],
}));
const runtimeLegacy = db.runtimeConfigs.countDocuments(Object.assign({}, runtimeFilter, {
  $or: [
    { 'branding.logo': { $regex: legacyPattern } },
    { 'branding.logoUrl': { $regex: legacyPattern } },
    { 'branding.backgroundImage': { $regex: legacyPattern } },
    { 'branding.faviconUrl': { $regex: legacyPattern } },
  ],
}));
print('tenants with legacy URL: ' + tenantLegacy);
print('runtimeConfigs with legacy URL: ' + runtimeLegacy);
`;
}

async function main(): Promise<void> {
  try {
    const { stdout } = await execFileAsync(
      MONGOSH_PATH,
      [MONGODB_URI, '--quiet', '--eval', buildScript()],
      { windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
    );
    console.log(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message.replace(MONGODB_URI, '<mongodb-uri>'));
    process.exit(1);
  }
}

void main();
