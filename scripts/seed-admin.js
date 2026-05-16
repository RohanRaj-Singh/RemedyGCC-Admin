/**
 * Admin Seed Script (CommonJS)
 * Creates initial super admin from environment variables
 *
 * Usage:
 *   node scripts/seed-admin.js
 *
 * Environment variables (from .env.local):
 *   ADMIN_EMAIL - Email for the admin account
 *   ADMIN_PASSWORD - Password for the admin account
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
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

  // Dynamic import for ES modules
  const { createInitialAdmin } = await import('../src/modules/auth/service.js');
  const { getAdminByEmail } = await import('../src/server/auth/repository.js');

  try {
    // Check if admin already exists
    const existingAdmin = await getAdminByEmail(adminEmail.toLowerCase());

    if (existingAdmin) {
      console.log('⚠️  Admin already exists:', existingAdmin.email);
      console.log('   Role:', existingAdmin.role);
      console.log('   Status:', existingAdmin.status);
      console.log('\n✅ Seed skipped (admin already exists).\n');
      process.exit(0);
    }

    // Create new admin
    const admin = await createInitialAdmin(
      adminEmail,
      adminPassword,
      'super_admin'
    );

    console.log('✅ Admin created successfully!');
    console.log('   Email:', admin.email);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('\n📝 You can now login at /login\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to seed admin:', error);
    process.exit(1);
  }
}

main();