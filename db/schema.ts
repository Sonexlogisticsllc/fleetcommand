import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── 1. CARRIERS TABLE ────────────────────────────────────────────────────────
export const carriers = sqliteTable('carriers', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  hasOwnAuthority: integer('has_own_authority', { mode: 'boolean' }).notNull().default(false),
  mcNumber: text('mc_number'),
  dotNumber: text('dot_number'),
  isLeasedMC: integer('is_leased_mc', { mode: 'boolean' }).notNull().default(false),
  mcHolderName: text('mc_holder_name'),
  mcHolderMC: text('mc_holder_mc'),
  insuranceType: text('insurance_type').notNull(), // vin_scheduled, certificate_holder, additional_insured
  insuranceCompany: text('insurance_company'),
  insurancePolicyNumber: text('insurance_policy_number'),
  dispatchFeePercent: real('dispatch_fee_percent').notNull().default(10),
  status: text('status').notNull().default('onboarding'), // active, inactive, onboarding
  notes: text('notes').notNull().default(''),
  portalEmail: text('portal_email').unique().notNull(),
  joinedAt: text('joined_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 2. CARRIER DRIVERS TABLE ──────────────────────────────────────────────────
export const carrierDrivers = sqliteTable('carrier_drivers', {
  id: text('id').primaryKey(),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // links to login account, set null on delete to protect history
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  contactEmail: text('contact_email').notNull(), // profile contact info, independent of users auth email
  phone: text('phone').notNull(),
  licenseNumber: text('license_number'),
  licenseState: text('license_state'),
  licenseClass: text('license_class'),
  status: text('status').notNull().default('active'), // active, inactive
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 3. CARRIER EQUIPMENT TABLE ────────────────────────────────────────────────
export const carrierEquipment = sqliteTable('carrier_equipment', {
  id: text('id').primaryKey(),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // truck, trailer
  equipmentType: text('equipment_type').notNull(), // dry_van, reefer, flatbed, lowboy, etc.
  year: integer('year').notNull(),
  make: text('make').notNull(),
  model: text('model').notNull(),
  vin: text('vin').notNull(),
  plate: text('plate').notNull(),
  state: text('state').notNull(),
  length: integer('length'), // for trailers (e.g. 53)
  weightCapacity: integer('weight_capacity'), // for trucks (e.g. 80000)
  status: text('status').notNull().default('active'), // active, inactive
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 4. USERS (PROFILES) TABLE ────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(), // single source of truth for credentials
  role: text('role').notNull(), // admin, carrier
  displayName: text('display_name').notNull(),
  carrierId: text('carrier_id').references(() => carriers.id, { onDelete: 'set null' }),
  avatar: text('avatar'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 5. SESSIONS TABLE (LUCIA AUTH) ───────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
});

// ─── 6. LOADS TABLE ───────────────────────────────────────────────────────────
export const loads = sqliteTable('loads', {
  id: text('id').primaryKey(),
  loadNumber: text('load_number').unique().notNull(),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'no action' }), // block deletion if carrier has loads to preserve auditing
  driverId: text('driver_id').references(() => carrierDrivers.id, { onDelete: 'set null' }),
  equipmentId: text('equipment_id').references(() => carrierEquipment.id, { onDelete: 'set null' }),
  brokerName: text('broker_name').notNull(),
  brokerContact: text('broker_contact').notNull(),
  brokerPhone: text('broker_phone').notNull(),
  brokerEmail: text('broker_email'),
  brokerMC: text('broker_mc'),
  pickupFacility: text('pickup_facility').notNull(),
  pickupAddress: text('pickup_address').notNull(),
  pickupCity: text('pickup_city').notNull(),
  pickupState: text('pickup_state').notNull(),
  pickupZip: text('pickup_zip').notNull(),
  pickupDate: text('pickup_date').notNull(), // ISO YYYY-MM-DD
  pickupTime: text('pickup_time').notNull(),
  pickupApptNumber: text('pickup_appt_number'),
  deliveryFacility: text('delivery_facility').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryCity: text('delivery_city').notNull(),
  deliveryState: text('delivery_state').notNull(),
  deliveryZip: text('delivery_zip').notNull(),
  deliveryDate: text('delivery_date').notNull(), // ISO YYYY-MM-DD
  deliveryTime: text('delivery_time').notNull(),
  deliveryApptNumber: text('delivery_appt_number'),
  commodity: text('commodity').notNull(),
  weight: integer('weight').notNull(),
  miles: real('miles').notNull(),
  rate: real('rate').notNull(),
  dispatchFeePercent: real('dispatch_fee_percent').notNull(),
  dispatchFeeAmount: real('dispatch_fee_amount').notNull(),
  carrierNet: real('carrier_net').notNull(),
  ratePerMile: real('rate_per_mile').notNull(),
  status: text('status').notNull().default('booked'), // 10 lifecycle stages
  ratConUrl: text('rat_con_url'),
  bolUrl: text('bol_url'),
  podUrl: text('pod_url'),
  notes: text('notes').notNull().default(''),
  freeTimeMinutes: integer('free_time_minutes').notNull().default(120),
  detentionHours: real('detention_hours').notNull().default(0),
  detentionRate: real('detention_rate').notNull().default(50), // standard $50/hr
  detentionRevenue: real('detention_revenue').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 7. LOAD CHECK-INS TABLE ──────────────────────────────────────────────────
export const loadCheckins = sqliteTable('load_checkins', {
  id: text('id').primaryKey(),
  loadId: text('load_id').notNull().references(() => loads.id, { onDelete: 'cascade' }),
  event: text('event').notNull(), // arrived_pickup, loaded_departing, arrived_delivery, delivered, etc.
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
  notes: text('notes').notNull().default(''),
  loggedBy: text('logged_by').notNull(), // admin, carrier
});

// ─── 8. CARGO PHOTOS TABLE ────────────────────────────────────────────────────
export const cargoPhotos = sqliteTable('cargo_photos', {
  id: text('id').primaryKey(),
  loadId: text('load_id').notNull().references(() => loads.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  stage: text('stage').notNull(), // pickup, delivery
  caption: text('caption').notNull().default(''),
  uploadedAt: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  uploadedBy: text('uploaded_by').notNull(), // admin, carrier
});

// ─── 9. CARRIER DOCUMENTS TABLE ────────────────────────────────────────────────
export const carrierDocuments = sqliteTable('carrier_documents', {
  id: text('id').primaryKey(),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  docType: text('doc_type').notNull(), // CDL, W9, COI, etc.
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url').notNull(),
  filePath: text('file_path').notNull(),
  expirationDate: text('expiration_date'), // ISO YYYY-MM-DD
  uploadedAt: text('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  uploadedBy: text('uploaded_by').notNull(), // admin, carrier
  notes: text('notes').notNull().default(''),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true), // compliance history tracker
}, (table) => ({
  carrierDocCurrentIdx: index('carrier_doc_current_idx').on(table.carrierId, table.docType, table.isCurrent),
}));

// ─── 10. SETTLEMENTS TABLE ────────────────────────────────────────────────────
export const settlements = sqliteTable('settlements', {
  id: text('id').primaryKey(),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  loadIds: text('load_ids').notNull(), // comma-separated load ids
  grossTotal: real('gross_total').notNull(),
  feeTotal: real('fee_total').notNull(),
  netTotal: real('net_total').notNull(),
  generatedAt: text('generated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ─── 11. SYSTEM SETTINGS TABLE ────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  companyName: text('company_name').notNull(),
  companyAddress: text('company_address'),
  companyCity: text('company_city'),
  companyState: text('company_state'),
  companyZip: text('company_zip'),
  companyEmail: text('company_email'),
  companyPhone: text('company_phone'),
  defaultDispatchFeePercent: real('default_dispatch_fee_percent').notNull().default(10),
  adminUsers: text('admin_users').notNull().default('[]'), // JSON array
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
