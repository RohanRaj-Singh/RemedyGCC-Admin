/**
 * Seed Admin Script
 * Creates initial admin user from environment variables
 */

import { createInitialAdmin } from '@/modules/auth/service';
import { getAdminByEmail } from '@/server/auth/repository';

export async function seedAdminIfNeeded(): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log('No ADMIN_EMAIL or ADMIN_PASSWORD configured - skipping seed');
    return false;
  }

  try {
    // Check if admin already exists
    const existingAdmin = await getAdminByEmail(adminEmail.toLowerCase());

    if (existingAdmin) {
      console.log('Admin already exists, skipping seed');
      return false;
    }

    // Create new admin
    const admin = await createInitialAdmin(
      adminEmail,
      adminPassword,
      'super_admin'
    );

    console.log(`Admin created successfully: ${admin.email}`);
    return true;
  } catch (error) {
    console.error('Failed to seed admin:', error);
    throw error;
  }
}

// Run seed if this is the entry point
seedAdminIfNeeded()
  .then(() => {
    console.log('Seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });