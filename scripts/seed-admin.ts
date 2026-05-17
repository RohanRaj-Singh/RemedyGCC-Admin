/**
 * Admin Seed Script
 * Creates the initial super admin from environment variables.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Environment variables:
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *   MONGODB_URI
 *   MONGOSH_PATH (optional)
 */

import dotenv from 'dotenv';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as bcrypt from 'bcryptjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const candidate of ['../.env.local', '../.env']) {
  const resolvedPath = path.resolve(__dirname, candidate);
  if (fs.existsSync(resolvedPath)) {
    dotenv.config({ path: resolvedPath });
  }
}

const MONGODB_URI =
  process.env.MONGODB_URI ||
  (process.env.NODE_ENV === 'production'
    ? ''
    : 'mongodb://127.0.0.1:27017/remedygcc');

const MONGOSH_PATH =
  process.env.MONGOSH_PATH ||
  (process.platform === 'win32' ? 'C:\\mongosh\\bin\\mongosh.exe' : 'mongosh');

async function runMongoScript(scriptBody: string) {
  const { stdout } = await execFileAsync(
    MONGOSH_PATH,
    [MONGODB_URI, '--quiet', '--eval', scriptBody],
    { windowsHide: true },
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

  return JSON.parse(lastLine);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('\nError: ADMIN_EMAIL and ADMIN_PASSWORD are required.\n');
    console.log('Set them in your env file before running the seed command.');
    process.exit(1);
  }

  if (!MONGODB_URI) {
    console.error('\nError: MONGODB_URI is required when running this script in production.\n');
    process.exit(1);
  }

  console.log('\nSeeding admin account...\n');

  try {
    const existingAdmin = await runMongoScript(`
      const admin = db.admins.findOne({ email: "${adminEmail}" }, { projection: { _id: 0 } });
      print(JSON.stringify(admin));
    `);

    if (existingAdmin) {
      console.log('Admin already exists:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Status:', existingAdmin.status);
      console.log('\nSeed skipped.\n');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    const result = await runMongoScript(`
      const newAdmin = {
        id: "${adminId}",
        email: "${adminEmail}",
        passwordHash: "${passwordHash}",
        role: "super_admin",
        status: "active",
        createdAt: "${now}",
        updatedAt: "${now}",
        lastLoginAt: null
      };
      db.admins.insertOne(newAdmin);
      print(JSON.stringify(newAdmin));
    `);

    try {
      await runMongoScript(`
        db.admins.createIndex({ email: 1 }, { unique: true, name: "admin_email_unique" });
        db.adminSessions.createIndex({ sessionToken: 1 }, { unique: true, name: "admin_session_token_unique" });
        db.adminSessions.createIndex({ adminId: 1 }, { name: "admin_sessions_admin_id" });
        db.adminSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_sessions_ttl" });
        print(JSON.stringify({ ok: true }));
      `);
    } catch {
      // Indexes may already exist.
    }

    console.log('Admin created successfully.');
    console.log('   Email:', result.email);
    console.log('   Role:', result.role);
    console.log('   Status:', result.status);
    console.log('\nYou can now log in at /login\n');
    process.exit(0);
  } catch (error) {
    console.error('\nFailed to seed admin:', error);
    process.exit(1);
  }
}

void main();
