import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── 0. MC OWNERS TABLE ────────────────────────────────────────────────────────
// An MC owner has one authority and may manage one or more leased carriers.
export const mcOwners = sqliteTable('mc_owners', {
  id: text('id').primaryKey(),
  ownerName: text('owner_name').notNull(),
  companyName: text('company_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  mcNumber: text('mc_number').unique().notNull(),
  dotNumber: text('dot_number'),
  canManageLeasedCarriers: integer('can_manage_leased_carriers', { mode: 'boolean' }).notNull().default(false),
  // Deliberately not a database FK to avoid a circular SQLite table definition.
  primaryCarrierId: text('primary_carrier_id'),
  defaultTotalFeePercent: real('default_total_fee_percent').notNull().default(18),
  defaultDispatchFeePercent: real('default_dispatch_fee_percent').notNull().default(8),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

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
  mcOwnerId: text('mc_owner_id').references(() => mcOwners.id, { onDelete: 'set null' }),
  // Total fee is the full deduction from broker gross. Dispatch fee is Sonex's portion.
  totalFeePercent: real('total_fee_percent').notNull().default(10),
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

export const driverPayProfiles = sqliteTable('driver_pay_profiles', {
  driverId: text('driver_id').primaryKey().references(() => carrierDrivers.id, { onDelete: 'cascade' }),
  payType: text('pay_type').notNull().default('per_mile'),
  payRate: real('pay_rate').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  payTypeIdx: index('driver_pay_type_idx').on(table.payType),
}));

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
  role: text('role').notNull(), // admin, mc_owner, carrier
  displayName: text('display_name').notNull(),
  carrierId: text('carrier_id').references(() => carriers.id, { onDelete: 'set null' }),
  mcOwnerId: text('mc_owner_id').references(() => mcOwners.id, { onDelete: 'set null' }),
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
  mcOwnerId: text('mc_owner_id').references(() => mcOwners.id, { onDelete: 'set null' }),
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
  totalFeePercent: real('total_fee_percent').notNull().default(10),
  totalFeeAmount: real('total_fee_amount').notNull().default(0),
  dispatchFeePercent: real('dispatch_fee_percent').notNull(),
  dispatchFeeAmount: real('dispatch_fee_amount').notNull(),
  mcOwnerFeeAmount: real('mc_owner_fee_amount').notNull().default(0),
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
// Dispatch ownership is deliberately separate from the commercial load record.
export const loadDispatchAssignments = sqliteTable('load_dispatch_assignments', {
  loadId: text('load_id').primaryKey().references(() => loads.id, { onDelete: 'cascade' }),
  dispatcherId: text('dispatcher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  dispatcherAssignmentIdx: index('load_dispatcher_idx').on(table.dispatcherId),
}));

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

// Operational work attached to a load or carrier.
export const operationalTasks = sqliteTable('operational_tasks', {
  id: text('id').primaryKey(),
  loadId: text('load_id').references(() => loads.id, { onDelete: 'cascade' }),
  carrierId: text('carrier_id').references(() => carriers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  category: text('category').notNull().default('dispatch'),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('open'),
  assigneeName: text('assignee_name'),
  dueAt: text('due_at'),
  completedAt: text('completed_at'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  taskLoadIdx: index('task_load_idx').on(table.loadId, table.status),
  taskCarrierIdx: index('task_carrier_idx').on(table.carrierId, table.status),
}));

export const loadExpenses = sqliteTable('load_expenses', {
  id: text('id').primaryKey(),
  loadId: text('load_id').notNull().references(() => loads.id, { onDelete: 'cascade' }),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  vendorName: text('vendor_name'),
  amount: real('amount').notNull(),
  incurredAt: text('incurred_at').notNull(),
  notes: text('notes').notNull().default(''),
  receiptUrl: text('receipt_url'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  expenseLoadIdx: index('expense_load_idx').on(table.loadId),
  expenseCarrierIdx: index('expense_carrier_idx').on(table.carrierId, table.incurredAt),
}));

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').unique().notNull(),
  loadId: text('load_id').notNull().references(() => loads.id, { onDelete: 'restrict' }),
  customerName: text('customer_name').notNull(),
  amount: real('amount').notNull(),
  status: text('status').notNull().default('draft'),
  issuedAt: text('issued_at'),
  dueAt: text('due_at'),
  paidAt: text('paid_at'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  invoiceLoadIdx: index('invoice_load_idx').on(table.loadId),
  invoiceStatusIdx: index('invoice_status_idx').on(table.status, table.dueAt),
}));

export const maintenanceTasks = sqliteTable('maintenance_tasks', {
  id: text('id').primaryKey(),
  equipmentId: text('equipment_id').notNull().references(() => carrierEquipment.id, { onDelete: 'cascade' }),
  carrierId: text('carrier_id').notNull().references(() => carriers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull().default('scheduled'),
  dueAt: text('due_at'),
  completedAt: text('completed_at'),
  estimatedCost: real('estimated_cost'),
  actualCost: real('actual_cost'),
  vendorName: text('vendor_name'),
  notes: text('notes').notNull().default(''),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  maintenanceEquipmentIdx: index('maintenance_equipment_idx').on(table.equipmentId, table.status),
  maintenanceDueIdx: index('maintenance_due_idx').on(table.status, table.dueAt),
}));
