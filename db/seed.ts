import { client, db } from './client';
import * as schema from './schema';
import { hash } from '@node-rs/argon2';

async function main() {
  console.log('🌱 Seeding database...');

  console.log('Hashing passwords...');
  const adminPasswordHash = await hash('sonex2026');
  const carrierPasswordHash = await hash('carrier2026');

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

  // 2. Carriers
  console.log('Inserting carriers...');
  const carrier1Id = 'c0000000-0000-0000-0000-000000000001';
  const carrier2Id = 'c0000000-0000-0000-0000-000000000002';

  await db.insert(schema.carriers).values([
    {
      id: carrier1Id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@carrier.com',
      phone: '(512) 555-0101',
      address: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      hasOwnAuthority: true,
      mcNumber: 'MC123456',
      dotNumber: 'DOT3456789',
      isLeasedMC: false,
      insuranceType: 'vin_scheduled',
      insuranceCompany: 'Progressive Commercial',
      insurancePolicyNumber: 'POL-12345678',
      dispatchFeePercent: 8,
      status: 'active',
      notes: 'Highly reliable dry van owner operator.',
      portalEmail: 'john@sonexcarrier.com',
    },
    {
      id: carrier2Id,
      firstName: 'Sarah',
      lastName: 'Smith',
      email: 'sarah.smith@logistics.com',
      phone: '(415) 555-0202',
      address: '456 Oak Ave',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      hasOwnAuthority: false,
      isLeasedMC: true,
      mcHolderName: 'Unified Logistics LLC',
      mcHolderMC: 'MC987654',
      insuranceType: 'certificate_holder',
      insuranceCompany: 'Great West Catalog',
      insurancePolicyNumber: 'GWC-98765432',
      dispatchFeePercent: 10,
      status: 'active',
      notes: 'Temperature controlled load specialist.',
      portalEmail: 'sarah@sonexcarrier.com',
    }
  ]).onConflictDoNothing();

  // 3. Users (lucia users/auth profiles)
  console.log('Inserting profiles...');
  const user1Id = 'a1111111-1111-1111-1111-111111111111'; // dispatcher
  const user2Id = 'a1111111-1111-1111-1111-111111111112'; // john doe
  const user3Id = 'a1111111-1111-1111-1111-111111111113'; // sarah smith

  await db.insert(schema.users).values([
    {
      id: user1Id,
      email: 'dispatch@sonexlogistics.com',
      passwordHash: adminPasswordHash,
      role: 'admin',
      displayName: 'Sonex Dispatch',
      avatar: 'SD',
    },
    {
      id: user2Id,
      email: 'john@sonexcarrier.com',
      passwordHash: carrierPasswordHash,
      role: 'carrier',
      displayName: 'John Doe',
      carrierId: carrier1Id,
      avatar: 'JD',
    },
    {
      id: user3Id,
      email: 'sarah@sonexcarrier.com',
      passwordHash: carrierPasswordHash,
      role: 'carrier',
      displayName: 'Sarah Smith',
      carrierId: carrier2Id,
      avatar: 'SS',
    }
  ]).onConflictDoNothing();

  // 4. Carrier Drivers
  console.log('Inserting drivers...');
  const driver1Id = 'd0000000-0000-0000-0000-000000000001';
  const driver2Id = 'd0000000-0000-0000-0000-000000000002';

  await db.insert(schema.carrierDrivers).values([
    {
      id: driver1Id,
      carrierId: carrier1Id,
      userId: user2Id,
      firstName: 'John',
      lastName: 'Doe',
      contactEmail: 'john@sonexcarrier.com',
      phone: '(512) 555-0101',
      licenseNumber: 'TX-DL-99281',
      licenseState: 'TX',
      licenseClass: 'A',
      status: 'active',
    },
    {
      id: driver2Id,
      carrierId: carrier2Id,
      userId: user3Id,
      firstName: 'Sarah',
      lastName: 'Smith',
      contactEmail: 'sarah@sonexcarrier.com',
      phone: '(415) 555-0202',
      licenseNumber: 'CA-DL-11028',
      licenseState: 'CA',
      licenseClass: 'A',
      status: 'active',
    }
  ]).onConflictDoNothing();

  // 5. Carrier Equipment
  console.log('Inserting equipment assets...');
  const truck1Id = 'e0000000-0000-0000-0000-000000000001';
  const trailer1Id = 'e0000000-0000-0000-0000-000000000002';
  const truck2Id = 'e0000000-0000-0000-0000-000000000003';
  const trailer2Id = 'e0000000-0000-0000-0000-000000000004';

  await db.insert(schema.carrierEquipment).values([
    {
      id: truck1Id,
      carrierId: carrier1Id,
      type: 'truck',
      equipmentType: 'dry_van',
      year: 2022,
      make: 'Freightliner',
      model: 'Cascadia',
      vin: '1FVACWDB8NHXXXXXX',
      plate: 'TX12345',
      state: 'TX',
      weightCapacity: 45000,
    },
    {
      id: trailer1Id,
      carrierId: carrier1Id,
      type: 'trailer',
      equipmentType: 'dry_van',
      year: 2021,
      make: 'Great Dane',
      model: 'Champion',
      vin: '53TRVINXXXXXXXXXX',
      plate: 'TR98765',
      state: 'TX',
      length: 53,
    },
    {
      id: truck2Id,
      carrierId: carrier2Id,
      type: 'truck',
      equipmentType: 'reefer',
      year: 2023,
      make: 'Peterbilt',
      model: '579',
      vin: '1XP5D49X5NDXXXXXX',
      plate: 'CA67890',
      state: 'CA',
      weightCapacity: 44000,
    },
    {
      id: trailer2Id,
      carrierId: carrier2Id,
      type: 'trailer',
      equipmentType: 'reefer',
      year: 2022,
      make: 'Utility',
      model: '3000R',
      vin: '53RFVINXXXXXXXXXX',
      plate: 'RF45678',
      state: 'CA',
      length: 53,
    }
  ]).onConflictDoNothing();

  // 6. Loads
  console.log('Inserting loads...');
  const load1Id = '10000000-0000-0000-0000-000000000001';
  const load2Id = '10000000-0000-0000-0000-000000000002';

  await db.insert(schema.loads).values([
    {
      id: load1Id,
      loadNumber: 'SNX-2026-001',
      carrierId: carrier1Id,
      driverId: driver1Id,
      equipmentId: truck1Id,
      brokerName: 'C.H. Robinson',
      brokerContact: 'Mark Davis',
      brokerPhone: '(800) 323-7587',
      brokerEmail: 'mark.davis@chrobinson.com',
      brokerMC: 'MC-1234',
      pickupFacility: 'PepsiCo Warehouse',
      pickupAddress: '1200 Beverage Dr',
      pickupCity: 'Dallas',
      pickupState: 'TX',
      pickupZip: '75201',
      pickupDate: '2026-06-29',
      pickupTime: '08:00',
      pickupApptNumber: 'APPT-1002',
      deliveryFacility: 'Walmart DC 6012',
      deliveryAddress: '500 Distribution Rd',
      deliveryCity: 'Houston',
      deliveryState: 'TX',
      deliveryZip: '77001',
      deliveryDate: '2026-06-29',
      deliveryTime: '14:00',
      deliveryApptNumber: 'APPT-5542',
      commodity: 'Beverages (Soda)',
      weight: 42000,
      miles: 240,
      rate: 950.00,
      dispatchFeePercent: 8.00,
      dispatchFeeAmount: 76.00,
      carrierNet: 874.00,
      ratePerMile: 3.96,
      status: 'booked',
      notes: 'Must maintain proper check-in times.',
      freeTimeMinutes: 120,
    },
    {
      id: load2Id,
      loadNumber: 'SNX-2026-002',
      carrierId: carrier2Id,
      driverId: driver2Id,
      equipmentId: truck2Id,
      brokerName: 'TQL',
      brokerContact: 'Jessica Miller',
      brokerPhone: '(800) 580-3101',
      brokerEmail: 'jmiller@tql.com',
      brokerMC: 'MC-5678',
      pickupFacility: 'Tyson Foods',
      pickupAddress: '400 Poultry Way',
      pickupCity: 'Springdale',
      pickupState: 'AR',
      pickupZip: '72764',
      pickupDate: '2026-06-29',
      pickupTime: '06:00',
      pickupApptNumber: 'PU-99182',
      deliveryFacility: 'Kroger Distribution',
      deliveryAddress: '101 Grocery Ln',
      deliveryCity: 'Cincinnati',
      deliveryState: 'OH',
      deliveryZip: '45201',
      deliveryDate: '2026-06-30',
      deliveryTime: '10:00',
      deliveryApptNumber: 'DEL-33821',
      commodity: 'Frozen Poultry',
      weight: 40000,
      miles: 650,
      rate: 2400.00,
      dispatchFeePercent: 10.00,
      dispatchFeeAmount: 240.00,
      carrierNet: 2160.00,
      ratePerMile: 3.69,
      status: 'in_transit',
      notes: 'Maintain temperature at -10F. Pre-cool trailer.',
      freeTimeMinutes: 120,
    }
  ]).onConflictDoNothing();

  // 7. Load Checkins
  console.log('Inserting check-ins...');
  await db.insert(schema.loadCheckins).values([
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      loadId: load2Id,
      event: 'arrived_pickup',
      timestamp: '2026-06-29T05:45:00.000Z',
      notes: 'Driver arrived at Tyson Foods pickup facility early.',
      loggedBy: 'carrier',
    },
    {
      id: 'c1111111-1111-1111-1111-111111111112',
      loadId: load2Id,
      event: 'loaded_departing',
      timestamp: '2026-06-29T07:15:00.000Z',
      notes: 'Loaded, trailer sealed #481992. Departing Tyson.',
      loggedBy: 'carrier',
    }
  ]);

  console.log('🌱 Database seeded successfully!');
  await client.close();
}

main().catch((err) => {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
});
