/**
 * Seed script: Migrate static clinic data from the marketing site
 * into the clinics collection in MongoDB.
 *
 * Usage: npm run seed:clinics
 *
 * This script is self-contained (does not import admin server modules)
 * to avoid the `server-only` guard.
 */

import dotenv from 'dotenv';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

dotenv.config({ path: '.env.local' });

const execFileAsync = promisify(execFile);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenantapp';

function getMongoshPath(): string {
  const configured = process.env.MONGOSH_PATH?.trim();
  if (configured) return configured;
  return process.platform === 'win32' ? 'C:\\mongosh\\bin\\mongosh.exe' : 'mongosh';
}

const SEED_DATA = [
  {
    slug: 'eunoia-clinic',
    name: 'Eunoia Clinic',
    nameAr: 'عيادة يونويا',
    logo: '/assets/clinics/eunoia-clinic/logo.png',
    phone: '+968 24121188, +968 71580235',
    address: 'First Tower - 2nd Floor, Way 6829 - Al Athiba, Azaiba, Muscat, Oman',
    addressAr: 'البرج الأول - الطابق الثاني، طريق 6829 - العذيبة، أزايبة، مسقط، عمان',
    description: 'Eunoia Clinic focuses on improving the quality of life for individuals and families by providing compassionate mental health care.',
    descriptionAr: 'تركز عيادة يونويا على تحسين جودة الحياة للأفراد والعائلات.',
    coordinates: { lat: 23.600, lng: 58.350 },
    googleMapsUrl: 'https://maps.app.goo.gl/LeAqKbakPTUzDkNi7',
    workingHours: [
      { day: 'Sunday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Monday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Tuesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Wednesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Thursday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: 'Closed' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الإثنين', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الثلاثاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الأربعاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الخميس', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: 'مغلق' },
    ],
  },
  {
    slug: 'hayat-counseling-center',
    name: 'Hayat Counseling Center',
    nameAr: 'مركز حياة للاستشارات',
    logo: '/assets/clinics/hayat-counseling-center/logo.jpg',
    phone: '+968 96335662',
    address: 'Al Khould, Oman',
    addressAr: 'الخوض، عمان',
    description: 'Hayat Counseling Center provides professional mental health services backed by over 13 years of experience.',
    descriptionAr: 'يقدم مركز حياة للاستشارات خدمات صحة نفسية مهنية.',
    coordinates: { lat: 23.6419, lng: 58.1845 },
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=23.6419,58.1845',
    workingHours: [
      { day: 'Sunday', hours: '10:00 AM - 8:30 PM' },
      { day: 'Monday', hours: '10:00 AM - 8:30 PM' },
      { day: 'Tuesday', hours: '10:00 AM - 8:30 PM' },
      { day: 'Wednesday', hours: '10:00 AM - 8:30 PM' },
      { day: 'Thursday', hours: '10:00 AM - 8:30 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: 'Closed' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '١٠:٠٠ صباحاً - ٨:٣٠ مساءً' },
      { day: 'الإثنين', hours: '١٠:٠٠ صباحاً - ٨:٣٠ مساءً' },
      { day: 'الثلاثاء', hours: '١٠:٠٠ صباحاً - ٨:٣٠ مساءً' },
      { day: 'الأربعاء', hours: '١٠:٠٠ صباحاً - ٨:٣٠ مساءً' },
      { day: 'الخميس', hours: '١٠:٠٠ صباحاً - ٨:٣٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: 'مغلق' },
    ],
  },
  {
    slug: 'al-harub-medical-center',
    name: 'Al Harub Medical Center',
    nameAr: 'مركز الحاروب الطبي',
    logo: '/assets/clinics/al-harub-medical-center/logo.png',
    phone: '+968 2460 0750, +968 9170 5886',
    email: 'info@alharubmedical.com',
    website: 'https://alharubmedical.com',
    address: 'Way 2830, House 2264, Al Kharijiyah Street, Al Shatti Al-Qurum, Muscat, Oman',
    addressAr: 'طريق ٢٨٣٠، منزل ٢٢٦٤، شارع الخريجية، الشاطئ القرم، مسقط، عمان',
    description: 'Al Harub Medical Center provides medical services and healthcare solutions.',
    descriptionAr: 'يقدم مركز الحاروب الطبي الخدمات الطبية وحلول الرعاية الصحية.',
    coordinates: { lat: 23.617, lng: 58.4704 },
    googleMapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=23.617,58.4704',
    workingHours: [
      { day: 'Sunday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Monday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Tuesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Wednesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Thursday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: 'Closed' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الإثنين', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الثلاثاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الأربعاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الخميس', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: 'مغلق' },
    ],
  },
  {
    slug: 'whispers-of-serenity-clinic',
    name: 'Whispers of Serenity Clinic',
    nameAr: 'عيادة همسات السكينة',
    logo: '/assets/clinics/whispers-of-serenity-clinic/logo.jpg',
    phone: '+968 99359779, +968 95717168',
    email: 'info@whispers-of-serenity.com',
    website: 'https://www.whispers-of-serenity.com',
    address: 'North Athaiba, 18th Nov. St., Way #6848, Villa #3086 A, Muscat, Oman',
    addressAr: 'شمال العذيبة، شارع ١٨ نوفمبر، طريق ٦٨٤٨، فيلا ٣٠٨٦ أ، مسقط، عمان',
    description: 'Whispers of Serenity Clinic is one of the pioneering private mental health clinics in Oman. Established in 2011.',
    descriptionAr: 'تعد عيادة همسات السكينة واحدة من أوائل عيادات الصحة النفسية الخاصة الرائدة في عمان.',
    coordinates: { lat: 23.594, lng: 58.363 },
    googleMapsUrl: 'https://maps.app.goo.gl/a5nrJdGJDoZUANbJ8',
    workingHours: [
      { day: 'Sunday', hours: '9:30 AM - 2:00 PM | 3:00 PM - 8:00 PM' },
      { day: 'Monday', hours: '9:30 AM - 2:00 PM | 3:00 PM - 8:00 PM' },
      { day: 'Tuesday', hours: '9:30 AM - 2:00 PM | 3:00 PM - 8:00 PM' },
      { day: 'Wednesday', hours: '9:30 AM - 2:00 PM | 3:00 PM - 8:00 PM' },
      { day: 'Thursday', hours: '9:30 AM - 2:00 PM | 3:00 PM - 8:00 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: 'Closed' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '٩:٣٠ صباحاً - ٢:٠٠ مساءً | ٣:٠٠ مساءً - ٨:٠٠ مساءً' },
      { day: 'الإثنين', hours: '٩:٣٠ صباحاً - ٢:٠٠ مساءً | ٣:٠٠ مساءً - ٨:٠٠ مساءً' },
      { day: 'الثلاثاء', hours: '٩:٣٠ صباحاً - ٢:٠٠ مساءً | ٣:٠٠ مساءً - ٨:٠٠ مساءً' },
      { day: 'الأربعاء', hours: '٩:٣٠ صباحاً - ٢:٠٠ مساءً | ٣:٠٠ مساءً - ٨:٠٠ مساءً' },
      { day: 'الخميس', hours: '٩:٣٠ صباحاً - ٢:٠٠ مساءً | ٣:٠٠ مساءً - ٨:٠٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: 'مغلق' },
    ],
  },
  {
    slug: 'ehtewa-mental-health-clinic',
    name: 'Ehtewa Mental Health Clinic',
    nameAr: 'عيادة احتواء للصحة النفسية',
    logo: '/assets/clinics/ehtewa-mental-health-clinic/logo.jpg',
    phone: '+968 72201479, +968 94440989',
    address: 'Al Mawaleh Al Janubiyya, Al-Izdihar Street, Seeb, Muscat, Oman',
    addressAr: 'الموالح الجنوبية، شارع الإزدهار، السيب، مسقط، عمان',
    description: 'Ehtewa Mental Health Clinic is a specialized psychological care facility offering psychiatry and family therapy services.',
    descriptionAr: 'عيادة احتواء للصحة النفسية هي منشأة رعاية نفسية متخصصة.',
    coordinates: { lat: 23.613, lng: 58.212 },
    googleMapsUrl: 'https://maps.app.goo.gl/h684uqSGqknNAJ9P6',
    workingHours: [
      { day: 'Sunday', hours: '10:00 AM - 9:00 PM' },
      { day: 'Monday', hours: '10:00 AM - 9:00 PM' },
      { day: 'Tuesday', hours: '10:00 AM - 9:00 PM' },
      { day: 'Wednesday', hours: '10:00 AM - 9:00 PM' },
      { day: 'Thursday', hours: '10:00 AM - 9:00 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: '10:00 AM - 4:00 PM' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '١٠:٠٠ صباحاً - ٩:٠٠ مساءً' },
      { day: 'الإثنين', hours: '١٠:٠٠ صباحاً - ٩:٠٠ مساءً' },
      { day: 'الثلاثاء', hours: '١٠:٠٠ صباحاً - ٩:٠٠ مساءً' },
      { day: 'الأربعاء', hours: '١٠:٠٠ صباحاً - ٩:٠٠ مساءً' },
      { day: 'الخميس', hours: '١٠:٠٠ صباحاً - ٩:٠٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: '١٠:٠٠ صباحاً - ٤:٠٠ مساءً' },
    ],
  },
  {
    slug: 'nine-wellness-centre',
    name: 'Nine – Pregnancy, Mother & Child Wellness Centre',
    nameAr: 'ناين – مركز صحة الأم والطفل والعائلة',
    logo: '/assets/clinics/nine-wellness-centre/logo.jpg',
    phone: '+968 77103166, +968 24124877',
    email: 'ninecenter.oman@gmail.com',
    address: 'First Tower - 2nd Floor, Way 6829 - Al Athiba, Azaiba, Muscat, Oman',
    addressAr: 'البرج الأول - الطابق الثاني، طريق 6829 - العذيبة، أزايبة، مسقط، عمان',
    description: 'Nine is a family-centred wellness and healthcare hub dedicated to supporting women, babies, and families.',
    descriptionAr: 'ناين هو مركز صحي وعائلي مخصص لدعم النساء والأطفال والعائلات.',
    coordinates: { lat: 23.600, lng: 58.350 },
    googleMapsUrl: 'https://maps.app.goo.gl/LeAqKbakPTUzDkNi7',
    workingHours: [
      { day: 'Sunday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Monday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Tuesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Wednesday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Thursday', hours: '9:00 AM - 6:00 PM' },
      { day: 'Friday', hours: 'Closed' },
      { day: 'Saturday', hours: 'Closed' },
    ],
    workingHoursAr: [
      { day: 'الأحد', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الإثنين', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الثلاثاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الأربعاء', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الخميس', hours: '٩:٠٠ صباحاً - ٦:٠٠ مساءً' },
      { day: 'الجمعة', hours: 'مغلق' },
      { day: 'السبت', hours: 'مغلق' },
    ],
  },
];

async function seed() {
  console.log('Seeding clinic data...\n');

  const now = new Date().toISOString();
  const clinics = SEED_DATA.map((s, i) => ({
    id: `clinic-${s.slug}-${Date.now().toString(36)}_${i}`,
    slug: s.slug,
    name: s.name,
    nameAr: s.nameAr || null,
    logo: s.logo || null,
    cardImage: null,
    coverImage: null,
    gallery: null,
    phone: s.phone || null,
    email: (s as any).email || null,
    website: (s as any).website || null,
    address: s.address || null,
    addressAr: s.addressAr || null,
    coordinates: s.coordinates || null,
    googleMapsUrl: s.googleMapsUrl || null,
    description: s.description || null,
    descriptionAr: s.descriptionAr || null,
    workingHours: s.workingHours || null,
    workingHoursAr: s.workingHoursAr || null,
    acceptsInPerson: true,
    redirectUrl: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  }));

  const payload = Buffer.from(JSON.stringify(clinics), 'utf8').toString('base64url');

  const script = `
const docs = JSON.parse(Buffer.from("${payload}", 'base64url').toString('utf8'));

// Ensure indexes
db.clinics.createIndex({ id: 1 }, { unique: true, name: 'clinic_id_unique' });
db.clinics.createIndex({ slug: 1 }, { unique: true, name: 'clinic_slug_unique' });
db.clinics.createIndex({ status: 1 }, { name: 'clinic_status_idx' });

let inserted = 0;
let skipped = 0;

docs.forEach(function(clinic) {
  const existing = db.clinics.findOne({ slug: clinic.slug });
  if (existing) {
    skipped++;
    return;
  }
  db.clinics.insertOne(clinic);
  inserted++;
});

print(JSON.stringify({ inserted: inserted, skipped: skipped }));
`;

  const tmpDir = await mkdtemp(join(tmpdir(), 'seed-clinics-'));
  try {
    const scriptPath = join(tmpDir, 'seed.js');
    await writeFile(scriptPath, script, 'utf8');

    const mongoshPath = getMongoshPath();
    const args = [scriptPath];
    if (MONGODB_URI) {
      args.unshift(MONGODB_URI);
    }

    const { stdout, stderr } = await execFileAsync(mongoshPath, args, {
      timeout: 30000,
      env: { ...process.env },
    });

    // Parse output — find the last JSON line
    const lines = stdout.split('\n').filter((l) => l.trim());
    let result: { inserted: number; skipped: number } | null = null;
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        result = JSON.parse(lines[i]);
        if (result && typeof result.inserted === 'number') break;
      } catch { /* not JSON */ }
    }

    if (result) {
      console.log(`  ✓ Inserted: ${result.inserted}`);
      console.log(`  ↪ Skipped (already exists): ${result.skipped}`);
      console.log('\nDone.');
    } else {
      console.log('stdout:', stdout);
      if (stderr) console.error('stderr:', stderr);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
