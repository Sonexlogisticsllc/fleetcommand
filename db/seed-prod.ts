import { client, db } from './client';
import * as schema from './schema';
import { hash } from '@node-rs/argon2';

async function main() {
  console.log('🌱 Seeding production database (clean structure only)...');

  console.log('Hashing admin password...');
  const adminPassword = process.env.TURSO_ADMIN_PASSWORD || 'SonexProd2026Secure!';
  const adminPasswordHash = await hash(adminPassword); // Admin password

  // 1. Settings
  console.log('Inserting settings...');
  await db.insert(schema.settings).values({
    id: 1,
    companyName: 'Sonex Logistics LLC',
    companyAddress: '525 Randall Ave Ste 100',
    companyCity: 'Cheyenne',
    companyState: 'WY',
    companyZip: '82001',
    companyEmail: 'dispatch@sonexlogistics.com',
    companyPhone: '(346) 421-2681',
    defaultDispatchFeePercent: 10,
    adminUsers: JSON.stringify([
      { id: 'a0000000-0000-0000-0000-000000000001', name: 'Sonex Dispatch', email: 'dispatch@sonexlogistics.com' }
    ]),
  }).onConflictDoUpdate({
    target: schema.settings.id,
    set: {
      companyName: 'Sonex Logistics LLC',
      companyAddress: '525 Randall Ave Ste 100',
      companyCity: 'Cheyenne',
      companyState: 'WY',
      companyZip: '82001',
      companyEmail: 'dispatch@sonexlogistics.com',
      companyPhone: '(346) 421-2681',
      defaultDispatchFeePercent: 10,
    }
  });

  // 2. Core Admin User (lucia users/auth profiles)
  console.log('Inserting admin profile...');
  const user1Id = 'a0000000-0000-0000-0000-000000000001'; // dispatcher admin

  await db.insert(schema.users).values([
    {
      id: user1Id,
      email: 'dispatch@sonexlogistics.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      displayName: 'Sonex Dispatch',
      avatar: 'SD',
    }
  ]).onConflictDoNothing();

  console.log('🌱 Production database seeded successfully!');
  await client.close();
}

main().catch((err) => {
  console.error('❌ Error seeding production database:', err);
  process.exit(1);
});
