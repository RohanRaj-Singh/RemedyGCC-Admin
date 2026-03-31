/**
 * Database Migration: Plan → Branding
 * 
 * Run this migration to convert all tenants from plan-based to branding-based configuration
 * 
 * Usage: npm run migrate:branding
 */

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'remedygcc';

interface TenantPlan {
  plan: 'free' | 'pro' | 'enterprise';
}

interface TenantBranding {
  branding: {
    logoUrl: string;
    faviconUrl?: string;
    colorScheme: {
      primaryColor: string;
      secondaryColor?: string;
      backgroundColor?: string;
      textColor?: string;
      accentColor?: string;
    };
    fontFamily?: string;
  };
}

const PLAN_TO_BRANDING_MAP: Record<string, TenantBranding['branding']> = {
  free: {
    logoUrl: '/default-logo.svg',
    colorScheme: {
      primaryColor: '156 63% 16%',
      secondaryColor: '0 0% 96%',
      backgroundColor: '0 0% 100%',
      textColor: '0 0% 43%',
      accentColor: '212 100% 50%',
    },
    fontFamily: 'Satoshi, Inter, sans-serif',
  },
  pro: {
    logoUrl: '/default-logo.svg',
    colorScheme: {
      primaryColor: '220 80% 50%',
      secondaryColor: '220 60% 95%',
      backgroundColor: '0 0% 100%',
      textColor: '220 10% 20%',
      accentColor: '140 70% 45%',
    },
    fontFamily: 'Roboto, sans-serif',
  },
  enterprise: {
    logoUrl: '/default-logo.svg',
    colorScheme: {
      primaryColor: '260 60% 55%',
      secondaryColor: '260 50% 95%',
      backgroundColor: '0 0% 100%',
      textColor: '260 10% 25%',
      accentColor: '340 75% 55%',
    },
    fontFamily: 'Montserrat, sans-serif',
  },
};

async function migrate() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db: Db = client.db(DB_NAME);
    
    console.log('🚀 Starting Plan → Branding Migration');
    console.log(`📦 Connected to: ${MONGODB_URI}/${DB_NAME}`);
    
    const tenantsCollection = db.collection('tenants');
    
    const tenantsWithoutBranding = await tenantsCollection.countDocuments({
      branding: { $exists: false },
    });
    
    console.log(`\n📊 Found ${tenantsWithoutBranding} tenants without branding configuration`);
    
    if (tenantsWithoutBranding === 0) {
      console.log('✅ All tenants already have branding configuration');
      return;
    }
    
    console.log('\n🔄 Migrating tenants...');
    
    const cursor = tenantsCollection.find({
      branding: { $exists: false },
      plan: { $exists: true },
    });
    
    let migrated = 0;
    let skipped = 0;
    
    for await (const tenant of cursor) {
      const plan = (tenant as unknown as TenantPlan).plan;
      const brandingConfig = PLAN_TO_BRANDING_MAP[plan] || PLAN_TO_BRANDING_MAP.free;
      
      await tenantsCollection.updateOne(
        { _id: tenant._id },
        { 
          $set: { 
            branding: brandingConfig,
            _migratedAt: new Date(),
            _migrationVersion: '1.0.0',
          },
          $rename: { plan: 'planLegacy' },
        }
      );
      
      migrated++;
      console.log(`  ✅ Migrated: ${tenant.name || tenant._id} (${plan} → custom branding)`);
    }
    
    const tenantsWithLegacyPlan = await tenantsCollection.countDocuments({
      plan: { $exists: true },
    });
    
    if (tenantsWithLegacyPlan === 0) {
      console.log('\n🗑️ Removing legacy plan field...');
      await tenantsCollection.updateMany(
        { planLegacy: { $exists: true } },
        { $unset: { plan: '' } }
      );
    }
    
    console.log('\n✅ Migration Complete!');
    console.log(`   📊 Total migrated: ${migrated}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    
    await db.collection('migrations').insertOne({
      name: 'plan-to-branding',
      version: '1.0.0',
      migratedAt: new Date(),
      tenantsAffected: migrated,
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

async function rollback() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db: Db = client.db(DB_NAME);
    
    console.log('🔄 Starting Rollback...');
    
    const tenantsCollection = db.collection('tenants');
    
    await tenantsCollection.updateMany(
      { planLegacy: { $exists: true } },
      { $rename: { planLegacy: 'plan' } }
    );
    
    await tenantsCollection.updateMany(
      { branding: { $exists: true } },
      { $unset: { branding: '' } }
    );
    
    console.log('✅ Rollback Complete');
    
    await db.collection('migrations').insertOne({
      name: 'plan-to-branding-rollback',
      version: '1.0.0',
      rolledBackAt: new Date(),
    });
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

const command = process.argv[2];

switch (command) {
  case 'up':
  case 'migrate':
    migrate();
    break;
  case 'down':
  case 'rollback':
    rollback();
    break;
  default:
    console.log(`
Usage: npx ts-node migrate-branding.ts <command>

Commands:
  up, migrate     - Run migration (plan → branding)
  down, rollback  - Rollback migration (branding → plan)

Examples:
  npm run migrate:branding -- up
  npm run migrate:branding -- down
    `);
}