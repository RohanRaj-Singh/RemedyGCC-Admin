/**
 * Admin Seed Script
 * Creates initial super admin from environment variables
 *
 * Usage:
 *   npm run seed:admin
 *
 * Environment variables (from .env.local):
 *   ADMIN_EMAIL - Email for the admin account
 *   ADMIN_PASSWORD - Password for the admin account
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenantapp';
const MONGOSH_PATH = process.env.MONGOSH_PATH || 'C:\\mongosh\\bin\\mongosh.exe';

async function runMongoScript(scriptBody: string) {
  const { stdout } = await execFileAsync(
    MONGOSH_PATH,
    [MONGODB_URI, '--quiet', '--eval', scriptBody],
    { windowsHide: true }
  );

  const lines = stdout.trim().split('\n');
  const lastLine = lines[lines.length - 1];

  if (!lastLine) {
    throw new Error('Empty response from MongoDB');
  }

  return JSON.parse(lastLine);
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('\n❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.\n');
    console.log('Please set them in your .env.local file:');
    console.log('  ADMIN_EMAIL=admin@example.com');
    console.log('  ADMIN_PASSWORD=YourSecurePassword123!\n');
    process.exit(1);
  }

  console.log('\n🌱 Seeding admin account...\n');

  try {
    // Check if admin already exists
    const existingAdmin = await runMongoScript(`
      const admin = db.admins.findOne({ email: "${adminEmail.toLowerCase()}" }, { projection: { _id: 0 } });
      print(JSON.stringify(admin));
    `);

    if (existingAdmin) {
      console.log('⚠️  Admin already exists:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Status:', existingAdmin.status);
      console.log('\n✅ Seed skipped (admin already exists).\n');
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Generate admin ID
    const adminId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const now = new Date().toISOString();

    // Create admin
    const result = await runMongoScript(`
      const newAdmin = {
        id: "${adminId}",
        email: "${adminEmail.toLowerCase()}",
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

    // Create indexes (if they don't exist)
    try {
      await runMongoScript(`
        db.admins.createIndex({ email: 1 }, { unique: true, name: "admin_email_unique" });
        db.adminSessions.createIndex({ sessionToken: 1 }, { unique: true, name: "admin_session_token_unique" });
        db.adminSessions.createIndex({ adminId: 1 }, { name: "admin_sessions_admin_id" });
        db.adminSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_sessions_ttl" });
        print("Indexes created or already exist");
      `);
    } catch {
      // Indexes may already exist, ignore error
    }

    console.log('✅ Admin created successfully!');
    console.log('   Email:', result.email);
    console.log('   Role:', result.role);
    console.log('   Status:', result.status);
    console.log('\n📝 You can now login at /login\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to seed admin:', error);
    process.exit(1);
  }
}

main();