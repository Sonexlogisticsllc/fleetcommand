// â”€â”€â”€ Sonex Dispatch Hub â€” Drizzle Turso/SQLite Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
'use server';

import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, desc, and, inArray, count, sum, avg } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import crypto from 'crypto';
import { getCurrentUserAction } from './authActions';
import { buildTodayActivity } from './dashboardActivity';


import {
  SonexCarrier, SonexLoad, SonexLoadCheckin, SonexCargoPhoto,
  SonexSettlement, SonexSettings, SonexUser, SonexMcOwner,
  computeLoadFinancials, LoadStatus, CheckinEvent,
} from './sonexTypes';

async function requireUser(): Promise<SonexUser> {
  const user = await getCurrentUserAction();
  if (!user) throw new Error('Your session has expired. Please sign in again.');
  return user;
}

async function requireAdminUser(): Promise<SonexUser> {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('Dispatcher authorization required.');
  return user;
}

type McOwnerScope = {
  id: string;
  canManageLeasedCarriers: boolean;
  primaryCarrierId: string | null;
};

async function getMcOwnerScope(user: SonexUser): Promise<McOwnerScope> {
  if (user.role !== 'mc_owner' || !user.mcOwnerId) {
    throw new Error('MC owner authorization required.');
  }
  const [owner] = await db.select({
    id: schema.mcOwners.id,
    canManageLeasedCarriers: schema.mcOwners.canManageLeasedCarriers,
    primaryCarrierId: schema.mcOwners.primaryCarrierId,
  }).from(schema.mcOwners).where(eq(schema.mcOwners.id, user.mcOwnerId)).limit(1);
  if (!owner || (!owner.canManageLeasedCarriers && !owner.primaryCarrierId)) {
    throw new Error('This MC owner account is not configured with an accessible carrier.');
  }
  return owner;
}

async function requireWorkspaceUser(): Promise<SonexUser> {
  const user = await requireUser();
  if (user.role !== 'admin' && user.role !== 'mc_owner') {
    throw new Error('Dispatcher or MC owner authorization required.');
  }
  return user;
}

async function canAccessCarrier(user: SonexUser, carrierId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (user.role === 'carrier') return user.carrierId === carrierId;
  const scope = await getMcOwnerScope(user);
  if (!scope.canManageLeasedCarriers) return scope.primaryCarrierId === carrierId;
  const [carrier] = await db.select({ mcOwnerId: schema.carriers.mcOwnerId })
    .from(schema.carriers).where(eq(schema.carriers.id, carrierId)).limit(1);
  return carrier?.mcOwnerId === scope.id;
}

async function requireCarrierAccess(carrierId: string): Promise<SonexUser> {
  const user = await requireUser();
  if (!await canAccessCarrier(user, carrierId)) {
    throw new Error('You do not have permission to access this carrier.');
  }
  return user;
}

async function requireLoadAccess(loadId: string) {
  const user = await requireUser();
  const [load] = await db.select().from(schema.loads).where(eq(schema.loads.id, loadId)).limit(1);
  if (!load) throw new Error('Load not found.');
  const mcOwnerScope = user.role === 'mc_owner' ? await getMcOwnerScope(user) : null;
  const hasAccess = user.role === 'admin'
    || user.role === 'carrier' && user.carrierId === load.carrierId
    || user.role === 'mc_owner' && Boolean(user.mcOwnerId) && user.mcOwnerId === load.mcOwnerId
      && (mcOwnerScope?.canManageLeasedCarriers || mcOwnerScope?.primaryCarrierId === load.carrierId);
  if (!hasAccess) {
    throw new Error('You do not have permission to access this load.');
  }
  return { user, load };
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


async function generateLoadNumber(existingLoads: SonexLoad[]): Promise<string> {
  const year = new Date().getFullYear();
  const pattern = new RegExp(`^SNX-${year}-(\\d+)$`);
  const existing = existingLoads
    .map(load => load.loadNumber.match(pattern)?.[1])
    .map(value => value ? Number.parseInt(value, 10) : Number.NaN)
    .filter(Number.isFinite);
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `SNX-${year}-${String(next).padStart(3, '0')}`;
}

// â”€â”€â”€ DB Mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function mapDbCarrier(c: typeof schema.carriers.$inferSelect): SonexCarrier {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    address: c.address || undefined,
    city: c.city || undefined,
    state: c.state || undefined,
    zip: c.zip || undefined,
    equipmentType: c.insuranceType === 'vin_scheduled' ? 'dry_van' : 'reefer', // placeholder to satisfy typescript or fetch equipment mapping
    truckYear: 2022,
    truckMake: 'Freightliner',
    truckModel: 'Cascadia',
    truckVin: '1FVACWDB8NHXXXXXX',
    truckPlate: 'TX12345',
    truckState: 'TX',
    weightCapacity: 45000,
    hasTrailer: true,
    trailerType: 'Dry Van',
    trailerVin: '53TRVINXXXXXXXXXX',
    trailerPlate: 'TR98765',
    trailerState: 'TX',
    trailerLength: 53,
    hasOwnAuthority: c.hasOwnAuthority,
    mcNumber: c.mcNumber || undefined,
    dotNumber: c.dotNumber || undefined,
    isLeasedMC: c.isLeasedMC,
    mcHolderName: c.mcHolderName || undefined,
    mcHolderMC: c.mcHolderMC || undefined,
    insuranceType: c.insuranceType as any,
    insuranceCompany: c.insuranceCompany || undefined,
    insurancePolicyNumber: c.insurancePolicyNumber || undefined,
    mcOwnerId: c.mcOwnerId || undefined,
    totalFeePercent: Number(c.totalFeePercent),
    dispatchFeePercent: Number(c.dispatchFeePercent),
    status: c.status as any,
    notes: c.notes,
    portalEmail: c.portalEmail,
    joinedAt: c.joinedAt,
    updatedAt: c.updatedAt,
  };
}

function mapDbLoad(l: typeof schema.loads.$inferSelect): SonexLoad {
  return {
    id: l.id,
    loadNumber: l.loadNumber,
    carrierId: l.carrierId,
    mcOwnerId: l.mcOwnerId || undefined,
    driverId: l.driverId || undefined,
    equipmentId: l.equipmentId || undefined,
    brokerName: l.brokerName,
    brokerContact: l.brokerContact,
    brokerPhone: l.brokerPhone,
    brokerEmail: l.brokerEmail || undefined,
    brokerMC: l.brokerMC || undefined,
    pickupFacility: l.pickupFacility,
    pickupAddress: l.pickupAddress,
    pickupCity: l.pickupCity,
    pickupState: l.pickupState,
    pickupZip: l.pickupZip,
    pickupDate: l.pickupDate,
    pickupTime: l.pickupTime,
    pickupApptNumber: l.pickupApptNumber || undefined,
    deliveryFacility: l.deliveryFacility,
    deliveryAddress: l.deliveryAddress,
    deliveryCity: l.deliveryCity,
    deliveryState: l.deliveryState,
    deliveryZip: l.deliveryZip,
    deliveryDate: l.deliveryDate,
    deliveryTime: l.deliveryTime,
    deliveryApptNumber: l.deliveryApptNumber || undefined,
    commodity: l.commodity,
    weight: l.weight,
    miles: Number(l.miles),
    rate: Number(l.rate),
    totalFeePercent: Number(l.totalFeePercent),
    totalFeeAmount: Number(l.totalFeeAmount),
    dispatchFeePercent: Number(l.dispatchFeePercent),
    dispatchFeeAmount: Number(l.dispatchFeeAmount),
    mcOwnerFeeAmount: Number(l.mcOwnerFeeAmount),
    carrierNet: Number(l.carrierNet),
    ratePerMile: Number(l.ratePerMile),
    status: l.status as any,
    ratConUrl: l.ratConUrl || undefined,
    bolUrl: l.bolUrl || undefined,
    podUrl: l.podUrl || undefined,
    notes: l.notes,
    freeTimeMinutes: l.freeTimeMinutes,
    detentionHours: Number(l.detentionHours),
    detentionRate: Number(l.detentionRate),
    detentionRevenue: Number(l.detentionRevenue),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

// â”€â”€â”€ Carriers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCarriers(): Promise<SonexCarrier[]> {
  try {
    const user = await requireWorkspaceUser();
    let list;
    if (user.role === 'mc_owner') {
      const scope = await getMcOwnerScope(user);
      list = scope.canManageLeasedCarriers
        ? await db.select().from(schema.carriers).where(eq(schema.carriers.mcOwnerId, scope.id)).orderBy(desc(schema.carriers.joinedAt))
        : await db.select().from(schema.carriers).where(eq(schema.carriers.id, scope.primaryCarrierId!)).orderBy(desc(schema.carriers.joinedAt));
    } else {
      list = await db.select().from(schema.carriers).orderBy(desc(schema.carriers.joinedAt));
    }
    return list.map(mapDbCarrier);
  } catch (err) {
    console.error('Error fetching carriers:', err);
    return [];
  }
}

function mapDbMcOwner(owner: typeof schema.mcOwners.$inferSelect): SonexMcOwner {
  return {
    id: owner.id,
    ownerName: owner.ownerName,
    companyName: owner.companyName,
    email: owner.email,
    phone: owner.phone,
    mcNumber: owner.mcNumber,
    dotNumber: owner.dotNumber || undefined,
    canManageLeasedCarriers: owner.canManageLeasedCarriers,
    primaryCarrierId: owner.primaryCarrierId || undefined,
    defaultTotalFeePercent: Number(owner.defaultTotalFeePercent),
    defaultDispatchFeePercent: Number(owner.defaultDispatchFeePercent),
    status: owner.status as 'active' | 'inactive',
    createdAt: owner.createdAt,
    updatedAt: owner.updatedAt,
  };
}

export async function getMcOwners(): Promise<SonexMcOwner[]> {
  const user = await requireWorkspaceUser();
  if (user.role === 'admin') {
    return (await db.select().from(schema.mcOwners).orderBy(schema.mcOwners.ownerName)).map(mapDbMcOwner);
  }
  const scope = await getMcOwnerScope(user);
  const rows = await db.select().from(schema.mcOwners).where(eq(schema.mcOwners.id, scope.id)).limit(1);
  return rows.map(mapDbMcOwner);
}

export async function getMcOwner(id: string): Promise<SonexMcOwner | undefined> {
  const user = await requireWorkspaceUser();
  if (user.role === 'mc_owner' && user.mcOwnerId !== id) throw new Error('You do not have permission to access this MC owner.');
  const [owner] = await db.select().from(schema.mcOwners).where(eq(schema.mcOwners.id, id)).limit(1);
  return owner ? mapDbMcOwner(owner) : undefined;
}

export type McOwnerInput = Omit<SonexMcOwner, 'id' | 'createdAt' | 'updatedAt'> & {
  portalPassword: string;
};

export async function addMcOwner(input: McOwnerInput): Promise<SonexMcOwner> {
  await requireAdminUser();
  if (!input.ownerName.trim() || !input.companyName.trim() || !input.mcNumber.trim() || !input.email.trim()) {
    throw new Error('Owner name, company, MC number, and login email are required.');
  }
  if (input.portalPassword.length < 10) throw new Error('Use a password with at least 10 characters.');
  if (input.defaultDispatchFeePercent < 0 || input.defaultTotalFeePercent < input.defaultDispatchFeePercent || input.defaultTotalFeePercent > 100) {
    throw new Error('Total fee must be between the dispatch fee and 100%.');
  }
  if (!input.canManageLeasedCarriers && !input.primaryCarrierId) {
    throw new Error('Select the primary carrier for an owner-operator account.');
  }

  const portalEmail = input.email.trim().toLowerCase();
  const [existingAccount] = await db.select({ role: schema.users.role, displayName: schema.users.displayName })
    .from(schema.users)
    .where(eq(schema.users.email, portalEmail))
    .limit(1);
  if (existingAccount) {
    const roleLabel = existingAccount.role === 'carrier' ? 'carrier portal' : existingAccount.role === 'mc_owner' ? 'MC owner portal' : 'admin portal';
    throw new Error(`${portalEmail} is already assigned to ${existingAccount.displayName}'s ${roleLabel}. Use a different email for this MC owner portal.`);
  }

  const [existingMcOwner] = await db.select({ id: schema.mcOwners.id })
    .from(schema.mcOwners)
    .where(eq(schema.mcOwners.mcNumber, input.mcNumber.trim()))
    .limit(1);
  if (existingMcOwner) throw new Error('This MC number already has an owner portal.');

  if (input.primaryCarrierId) {
    const [primaryCarrier] = await db.select({ id: schema.carriers.id }).from(schema.carriers)
      .where(eq(schema.carriers.id, input.primaryCarrierId)).limit(1);
    if (!primaryCarrier) throw new Error('Selected primary carrier no longer exists.');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.mcOwners).values({
    id,
    ownerName: input.ownerName.trim(),
    companyName: input.companyName.trim(),
    email: portalEmail,
    phone: input.phone.trim(),
    mcNumber: input.mcNumber.trim(),
    dotNumber: input.dotNumber?.trim(),
    canManageLeasedCarriers: input.canManageLeasedCarriers,
    primaryCarrierId: input.primaryCarrierId,
    defaultTotalFeePercent: input.defaultTotalFeePercent,
    defaultDispatchFeePercent: input.defaultDispatchFeePercent,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  });
  try {
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      email: portalEmail,
      passwordHash: await hash(input.portalPassword),
      role: 'mc_owner',
      displayName: input.ownerName.trim(),
      mcOwnerId: id,
      avatar: input.ownerName.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    });
    if (input.primaryCarrierId) {
      await db.update(schema.carriers).set({
        mcOwnerId: id,
        isLeasedMC: true,
        mcHolderName: input.companyName.trim(),
        mcHolderMC: input.mcNumber.trim(),
        totalFeePercent: input.defaultTotalFeePercent,
        dispatchFeePercent: input.defaultDispatchFeePercent,
        updatedAt: now,
      }).where(eq(schema.carriers.id, input.primaryCarrierId));
    }
  } catch (error) {
    await db.delete(schema.mcOwners).where(eq(schema.mcOwners.id, id));
    throw error;
  }
  return (await getMcOwner(id))!;
}

export async function updateMcOwner(id: string, data: Partial<Omit<McOwnerInput, 'portalPassword'>>): Promise<SonexMcOwner> {
  await requireAdminUser();
  const [current] = await db.select().from(schema.mcOwners).where(eq(schema.mcOwners.id, id)).limit(1);
  if (!current) throw new Error('MC owner not found.');
  const totalFeePercent = data.defaultTotalFeePercent ?? Number(current.defaultTotalFeePercent);
  const dispatchFeePercent = data.defaultDispatchFeePercent ?? Number(current.defaultDispatchFeePercent);
  const canManageLeasedCarriers = data.canManageLeasedCarriers ?? current.canManageLeasedCarriers;
  const primaryCarrierId = data.primaryCarrierId !== undefined ? data.primaryCarrierId || null : current.primaryCarrierId;
  if (dispatchFeePercent < 0 || totalFeePercent < dispatchFeePercent || totalFeePercent > 100) {
    throw new Error('Total fee must be between the dispatch fee and 100%.');
  }
  if (!canManageLeasedCarriers && !primaryCarrierId) {
    throw new Error('Choose a primary carrier for an owner-operator authority.');
  }
  if (primaryCarrierId) {
    const [primaryCarrier] = await db.select({ id: schema.carriers.id }).from(schema.carriers)
      .where(eq(schema.carriers.id, primaryCarrierId)).limit(1);
    if (!primaryCarrier) throw new Error('Selected primary carrier no longer exists.');
  }
  await db.update(schema.mcOwners).set({
    ownerName: data.ownerName?.trim() ?? current.ownerName,
    companyName: data.companyName?.trim() ?? current.companyName,
    email: data.email?.trim().toLowerCase() ?? current.email,
    phone: data.phone?.trim() ?? current.phone,
    mcNumber: data.mcNumber?.trim() ?? current.mcNumber,
    dotNumber: data.dotNumber?.trim() ?? current.dotNumber,
    canManageLeasedCarriers,
    primaryCarrierId,
    defaultTotalFeePercent: totalFeePercent,
    defaultDispatchFeePercent: dispatchFeePercent,
    status: data.status ?? current.status,
    updatedAt: new Date().toISOString(),
  }).where(eq(schema.mcOwners.id, id));
  if (primaryCarrierId) {
    await db.update(schema.carriers).set({ mcOwnerId: id, updatedAt: new Date().toISOString() })
      .where(eq(schema.carriers.id, primaryCarrierId));
  }
  return (await getMcOwner(id))!;
}

export async function resetMcOwnerPortalPassword(mcOwnerId: string, password: string): Promise<void> {
  await requireAdminUser();
  if (password.length < 10) throw new Error('Use a password with at least 10 characters.');
  const [account] = await db.select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.mcOwnerId, mcOwnerId), eq(schema.users.role, 'mc_owner')))
    .limit(1);
  if (!account) throw new Error('MC owner portal account not found.');
  await db.update(schema.users).set({ passwordHash: await hash(password), updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, account.id));
}

export async function getCarrier(id: string): Promise<SonexCarrier | undefined> {
  try {
    await requireCarrierAccess(id);
    const results = await db.select().from(schema.carriers).where(eq(schema.carriers.id, id)).limit(1);
    if (results.length === 0) return undefined;
    return mapDbCarrier(results[0]);
  } catch (err) {
    console.error('Error fetching carrier:', err);
    return undefined;
  }
}

export async function createCarrierPortalUser(
  carrierId: string,
  email: string,
  password: string,
  displayName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdminUser();
    const userId = crypto.randomUUID();
    const passwordHash = await hash(password);
    const avatar = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    await db.insert(schema.users).values({
      id: userId,
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'carrier',
      displayName,
      carrierId,
      avatar,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error creating carrier portal user:', err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}

export type CarrierPortalAccount = {
  userId: string;
  carrierId: string;
  displayName: string;
  email: string;
  carrierName: string;
  status: string;
};

export async function getCarrierPortalAccounts(): Promise<CarrierPortalAccount[]> {
  await requireAdminUser();
  const rows = await db.select({
    userId: schema.users.id,
    carrierId: schema.users.carrierId,
    displayName: schema.users.displayName,
    email: schema.users.email,
    firstName: schema.carriers.firstName,
    lastName: schema.carriers.lastName,
    status: schema.carriers.status,
  }).from(schema.users)
    .innerJoin(schema.carriers, eq(schema.users.carrierId, schema.carriers.id))
    .where(eq(schema.users.role, 'carrier'))
    .orderBy(schema.carriers.firstName, schema.carriers.lastName);

  return rows.map(row => ({
    userId: row.userId,
    carrierId: row.carrierId!,
    displayName: row.displayName,
    email: row.email,
    carrierName: `${row.firstName} ${row.lastName}`,
    status: row.status,
  }));
}

export async function resetCarrierPortalPassword(userId: string, password: string): Promise<void> {
  await requireAdminUser();
  if (password.length < 10) throw new Error('Use a password with at least 10 characters.');
  const [account] = await db.select({ id: schema.users.id, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!account || account.role !== 'carrier') throw new Error('Carrier portal account not found.');

  await db.update(schema.users).set({ passwordHash: await hash(password), updatedAt: new Date().toISOString() }).where(eq(schema.users.id, userId));
}

export async function addCarrier(
  data: Omit<SonexCarrier, 'id' | 'joinedAt' | 'updatedAt'> & { portalPassword?: string }
): Promise<SonexCarrier> {
  try {
    const user = await requireUser();
    if (user.role !== 'admin' && user.role !== 'mc_owner') throw new Error('Dispatcher or MC owner authorization required.');
    const scope = user.role === 'mc_owner' ? await getMcOwnerScope(user) : null;
    if (scope && !scope.canManageLeasedCarriers) throw new Error('This MC owner account cannot add leased carriers.');
    const { portalPassword, ...carrierData } = data as any;
    const carrierId = crypto.randomUUID();
    const mcOwnerId = scope ? scope.id : carrierData.mcOwnerId || null;
    let totalFeePercent = Number(carrierData.totalFeePercent ?? carrierData.dispatchFeePercent);
    let dispatchFeePercent = Number(carrierData.dispatchFeePercent);
    if (scope) {
      totalFeePercent = Number((await getMcOwner(scope.id))!.defaultTotalFeePercent);
      dispatchFeePercent = Number((await getMcOwner(scope.id))!.defaultDispatchFeePercent);
    }
    if (totalFeePercent < dispatchFeePercent || totalFeePercent > 100 || dispatchFeePercent < 0) {
      throw new Error('Total fee must be between the dispatch fee and 100%.');
    }

    await db.insert(schema.carriers).values({
      id: carrierId,
      firstName: carrierData.firstName,
      lastName: carrierData.lastName,
      email: carrierData.email,
      phone: carrierData.phone,
      address: carrierData.address,
      city: carrierData.city,
      state: carrierData.state,
      zip: carrierData.zip,
      hasOwnAuthority: carrierData.hasOwnAuthority,
      mcNumber: carrierData.mcNumber,
      dotNumber: carrierData.dotNumber,
      isLeasedMC: Boolean(mcOwnerId) || carrierData.isLeasedMC,
      mcHolderName: carrierData.mcHolderName,
      mcHolderMC: carrierData.mcHolderMC,
      insuranceType: carrierData.insuranceType,
      insuranceCompany: carrierData.insuranceCompany,
      insurancePolicyNumber: carrierData.insurancePolicyNumber,
      mcOwnerId,
      totalFeePercent,
      dispatchFeePercent,
      status: carrierData.status,
      notes: carrierData.notes,
      portalEmail: carrierData.portalEmail,
    });

    // Create portal login if email + password provided
    if (carrierData.portalEmail && portalPassword) {
      const displayName = `${carrierData.firstName} ${carrierData.lastName}`;
      try {
        await db.insert(schema.users).values({
          id: crypto.randomUUID(),
          email: carrierData.portalEmail.trim().toLowerCase(),
          passwordHash: await hash(portalPassword),
          role: 'carrier',
          displayName,
          carrierId,
          avatar: displayName.split(' ').map((word: string) => word[0]).join('').slice(0, 2).toUpperCase(),
        });
      } catch (error: any) {
        await db.delete(schema.carriers).where(eq(schema.carriers.id, carrierId));
        throw new Error(`Carrier login could not be created: ${error?.message ?? 'Unknown error'}`);
      }
    }

    const created = await getCarrier(carrierId);
    if (!created) throw new Error('Failed to retrieve created carrier');
    return created;
  } catch (err) {
    console.error('Error adding carrier:', err);
    throw err;
  }
}

export async function updateCarrier(id: string, data: Partial<SonexCarrier>): Promise<SonexCarrier | null> {
  try {
    const user = await requireCarrierAccess(id);
    if (user.role === 'carrier') {
      data = {
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
      };
    } else if (user.role === 'mc_owner') {
      const scope = await getMcOwnerScope(user);
      if (!scope.canManageLeasedCarriers) throw new Error('This MC owner account cannot edit leased carriers.');
      // Financial percentages and authority assignment are owned by Sonex Dispatch.
      const { mcOwnerId, totalFeePercent, dispatchFeePercent, ...allowed } = data;
      data = allowed;
    }
    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.zip !== undefined) updateData.zip = data.zip;
    if (data.hasOwnAuthority !== undefined) updateData.hasOwnAuthority = data.hasOwnAuthority;
    if (data.mcNumber !== undefined) updateData.mcNumber = data.mcNumber;
    if (data.dotNumber !== undefined) updateData.dotNumber = data.dotNumber;
    if (data.isLeasedMC !== undefined) updateData.isLeasedMC = data.isLeasedMC;
    if (data.mcHolderName !== undefined) updateData.mcHolderName = data.mcHolderName;
    if (data.mcHolderMC !== undefined) updateData.mcHolderMC = data.mcHolderMC;
    if (data.insuranceType !== undefined) updateData.insuranceType = data.insuranceType;
    if (data.insuranceCompany !== undefined) updateData.insuranceCompany = data.insuranceCompany;
    if (data.insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = data.insurancePolicyNumber;
    if (user.role === 'admin' && data.mcOwnerId !== undefined) updateData.mcOwnerId = data.mcOwnerId || null;
    if (user.role === 'admin' && data.totalFeePercent !== undefined) updateData.totalFeePercent = data.totalFeePercent;
    if (user.role === 'admin' && data.dispatchFeePercent !== undefined) updateData.dispatchFeePercent = data.dispatchFeePercent;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.portalEmail !== undefined) updateData.portalEmail = data.portalEmail;
    updateData.updatedAt = new Date().toISOString();

    await db.update(schema.carriers).set(updateData).where(eq(schema.carriers.id, id));
    return await getCarrier(id) || null;
  } catch (err) {
    console.error('Error updating carrier:', err);
    return null;
  }
}

export type DeleteCarrierResult = { disposition: 'deleted' | 'archived' };

export async function deleteCarrier(id: string): Promise<DeleteCarrierResult> {
  try {
    const user = await requireCarrierAccess(id);
    if (user.role === 'mc_owner' && !(await getMcOwnerScope(user)).canManageLeasedCarriers) {
      throw new Error('This MC owner account cannot remove leased carriers.');
    }
    if (user.role === 'carrier') throw new Error('Carrier accounts cannot delete carrier profiles.');
    const [loadReference] = await db.select({ id: schema.loads.id }).from(schema.loads)
      .where(eq(schema.loads.carrierId, id)).limit(1);

    // Removing the portal login revokes access even when the profile must be retained for historical loads.
    await db.delete(schema.users).where(and(eq(schema.users.carrierId, id), eq(schema.users.role, 'carrier')));

    if (loadReference) {
      await db.update(schema.carriers).set({ status: 'inactive', updatedAt: new Date().toISOString() })
        .where(eq(schema.carriers.id, id));
      return { disposition: 'archived' };
    }

    await db.delete(schema.carriers).where(eq(schema.carriers.id, id));
    return { disposition: 'deleted' };
  } catch (err) {
    console.error('Error deleting carrier:', err);
    throw err;
  }
}

// â”€â”€â”€ Loads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getLoads(): Promise<SonexLoad[]> {
  try {
    const user = await requireWorkspaceUser();
    let list;
    if (user.role === 'mc_owner') {
      const scope = await getMcOwnerScope(user);
      list = scope.canManageLeasedCarriers
        ? await db.select().from(schema.loads).where(eq(schema.loads.mcOwnerId, scope.id)).orderBy(desc(schema.loads.createdAt))
        : await db.select().from(schema.loads).where(and(eq(schema.loads.mcOwnerId, scope.id), eq(schema.loads.carrierId, scope.primaryCarrierId!))).orderBy(desc(schema.loads.createdAt));
    } else {
      list = await db.select().from(schema.loads).orderBy(desc(schema.loads.createdAt));
    }
    return list.map(mapDbLoad);
  } catch (err) {
    console.error('Error fetching loads:', err);
    return [];
  }
}

export async function getLoad(id: string): Promise<SonexLoad | undefined> {
  try {
    const { load } = await requireLoadAccess(id);
    return mapDbLoad(load);
  } catch (err) {
    console.error('Error fetching load:', err);
    return undefined;
  }
}

export async function getLoadsByCarrier(carrierId: string): Promise<SonexLoad[]> {
  try {
    const user = await requireCarrierAccess(carrierId);
    const list = user.role === 'mc_owner'
      ? await db.select().from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), eq(schema.loads.mcOwnerId, user.mcOwnerId!))).orderBy(desc(schema.loads.createdAt))
      : await db.select().from(schema.loads).where(eq(schema.loads.carrierId, carrierId)).orderBy(desc(schema.loads.createdAt));
    return list.map(mapDbLoad);
  } catch (err) {
    console.error('Error fetching loads by carrier:', err);
    return [];
  }
}

export async function addLoad(
  data: Omit<SonexLoad, 'id' | 'loadNumber' | 'totalFeeAmount' | 'dispatchFeeAmount' | 'mcOwnerFeeAmount' | 'carrierNet' | 'ratePerMile' | 'createdAt' | 'updatedAt' | 'freeTimeMinutes' | 'detentionHours' | 'detentionRate' | 'detentionRevenue'> & {
    freeTimeMinutes?: number;
    detentionRate?: number;
  }
): Promise<SonexLoad> {
  try {
    const user = await requireUser();
    if (!await canAccessCarrier(user, data.carrierId)) {
      throw new Error('You do not have permission to create a load for this carrier.');
    }
    const [carrier] = await db.select().from(schema.carriers).where(eq(schema.carriers.id, data.carrierId)).limit(1);
    if (!carrier) throw new Error('Carrier not found.');
    const totalFeePercent = user.role === 'admin'
      ? Number(data.totalFeePercent ?? carrier.totalFeePercent)
      : Number(carrier.totalFeePercent);
    const dispatchFeePercent = user.role === 'admin'
      ? Number(data.dispatchFeePercent ?? carrier.dispatchFeePercent)
      : Number(carrier.dispatchFeePercent);
    const mcOwnerId = carrier.mcOwnerId || null;
    const { totalFeeAmount, dispatchFeeAmount, mcOwnerFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(
      data.rate, data.miles, totalFeePercent, dispatchFeePercent,
    );
    const existing = (await db.select().from(schema.loads)).map(mapDbLoad);
    const loadNumber = await generateLoadNumber(existing);
    const id = crypto.randomUUID();

    let driverId = data.driverId;
    let equipmentId = data.equipmentId;
    if (user.role === 'carrier') {
      const [linkedDriver] = await db.select({ id: schema.carrierDrivers.id })
        .from(schema.carrierDrivers)
        .where(and(eq(schema.carrierDrivers.carrierId, data.carrierId), eq(schema.carrierDrivers.userId, user.id)))
        .limit(1);
      driverId = driverId ?? linkedDriver?.id;
    }
    if (!equipmentId) {
      const [activeTruck] = await db.select({ id: schema.carrierEquipment.id })
        .from(schema.carrierEquipment)
        .where(and(
          eq(schema.carrierEquipment.carrierId, data.carrierId),
          eq(schema.carrierEquipment.type, 'truck'),
          eq(schema.carrierEquipment.status, 'active'),
        ))
        .limit(1);
      equipmentId = activeTruck?.id;
    }

    await db.insert(schema.loads).values({
      id,
      loadNumber,
      carrierId: data.carrierId,
      mcOwnerId,
      driverId,
      equipmentId,
      brokerName: data.brokerName,
      brokerContact: data.brokerContact,
      brokerPhone: data.brokerPhone,
      brokerEmail: data.brokerEmail,
      brokerMC: data.brokerMC,
      pickupFacility: data.pickupFacility,
      pickupAddress: data.pickupAddress,
      pickupCity: data.pickupCity,
      pickupState: data.pickupState,
      pickupZip: data.pickupZip,
      pickupDate: data.pickupDate,
      pickupTime: data.pickupTime,
      pickupApptNumber: data.pickupApptNumber,
      deliveryFacility: data.deliveryFacility,
      deliveryAddress: data.deliveryAddress,
      deliveryCity: data.deliveryCity,
      deliveryState: data.deliveryState,
      deliveryZip: data.deliveryZip,
      deliveryDate: data.deliveryDate,
      deliveryTime: data.deliveryTime,
      deliveryApptNumber: data.deliveryApptNumber,
      commodity: data.commodity,
      weight: data.weight,
      miles: data.miles,
      rate: data.rate,
      totalFeePercent,
      totalFeeAmount,
      dispatchFeePercent,
      dispatchFeeAmount,
      mcOwnerFeeAmount,
      carrierNet,
      ratePerMile,
      status: data.status,
      notes: data.notes,
      freeTimeMinutes: data.freeTimeMinutes ?? 120,
      detentionHours: 0,
      detentionRate: data.detentionRate ?? 50,
      detentionRevenue: 0,
      ratConUrl: data.ratConUrl,
      bolUrl: data.bolUrl,
      podUrl: data.podUrl,
    });

    return await getLoad(id) as SonexLoad;
  } catch (err) {
    console.error('Error adding load:', err);
    throw err;
  }
}

export async function updateLoad(id: string, data: Partial<SonexLoad>): Promise<SonexLoad | null> {
  try {
    const access = await requireLoadAccess(id);
    const current = mapDbLoad(access.load);
    const isAdmin = access.user.role === 'admin';
    const isMcOwner = access.user.role === 'mc_owner';
    if (!isAdmin && !isMcOwner) {
      const carrierFields = new Set(['status', 'bolUrl', 'podUrl']);
      const forbidden = Object.keys(data).filter(key => !carrierFields.has(key));
      if (forbidden.length) throw new Error('Carriers can update status, BOL, and POD fields only.');
    }

    const updated = { ...current, ...data };

    if (isAdmin && data.carrierId !== undefined && data.carrierId !== current.carrierId) {
      const [assignedCarrier] = await db.select().from(schema.carriers).where(eq(schema.carriers.id, data.carrierId)).limit(1);
      if (!assignedCarrier) throw new Error('Selected carrier no longer exists.');
      updated.mcOwnerId = assignedCarrier.mcOwnerId || undefined;
      if (data.totalFeePercent === undefined) updated.totalFeePercent = Number(assignedCarrier.totalFeePercent);
      if (data.dispatchFeePercent === undefined) updated.dispatchFeePercent = Number(assignedCarrier.dispatchFeePercent);
    }
    
    if (isMcOwner) {
      // MC owners can edit operational load fields, never commercial splits or carrier assignment.
      updated.carrierId = current.carrierId;
      updated.mcOwnerId = current.mcOwnerId;
      updated.totalFeePercent = current.totalFeePercent;
      updated.dispatchFeePercent = current.dispatchFeePercent;
      updated.totalFeeAmount = current.totalFeeAmount;
      updated.dispatchFeeAmount = current.dispatchFeeAmount;
      updated.mcOwnerFeeAmount = current.mcOwnerFeeAmount;
      updated.carrierNet = current.carrierNet;
    }

    if (data.rate !== undefined || data.miles !== undefined || (isAdmin && (data.totalFeePercent !== undefined || data.dispatchFeePercent !== undefined))) {
      const { totalFeeAmount, dispatchFeeAmount, mcOwnerFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(
        updated.rate, updated.miles, updated.totalFeePercent, updated.dispatchFeePercent
      );
      updated.totalFeeAmount = totalFeeAmount;
      updated.dispatchFeeAmount = dispatchFeeAmount;
      updated.mcOwnerFeeAmount = mcOwnerFeeAmount;
      updated.carrierNet = carrierNet;
      updated.ratePerMile = ratePerMile;
    }

    if (data.status && data.status !== current.status) {
      if (!isAdmin) {
        const allowedTransitions: Record<LoadStatus, LoadStatus[]> = {
          booked: ['dispatched'],
          dispatched: ['booked', 'in_transit'],
          in_transit: ['dispatched', 'delivered', 'pod_received'],
          delivered: ['in_transit', 'pod_received'],
          pod_received: ['delivered', 'invoiced'],
          invoiced: ['pod_received', 'paid'],
          paid: ['invoiced'],
        };
        
        const allowed = allowedTransitions[current.status as LoadStatus] || [];
        if (!allowed.includes(data.status)) {
          throw new Error(`Invalid status transition from "${current.status}" to "${data.status}".`);
        }
        if (data.status === 'pod_received' && current.status === 'in_transit') {
          if (!data.podUrl) throw new Error('A POD document is required before marking POD received.');
          const deliveryCheckins = await db.select({ id: schema.loadCheckins.id })
            .from(schema.loadCheckins)
            .where(and(eq(schema.loadCheckins.loadId, id), eq(schema.loadCheckins.event, 'arrived_delivery')))
            .limit(1);
          if (!deliveryCheckins.length) {
            throw new Error('Arrived at delivery must be logged before submitting POD.');
          }
        }
      }

      // Log audit checkin for status change
      await db.insert(schema.loadCheckins).values({
        id: crypto.randomUUID(),
        loadId: id,
        event: `status_${data.status}` as any,
        timestamp: new Date().toISOString(),
        notes: `Status transitioned from "${current.status}" to "${data.status}".`,
        loggedBy: access.user.role,
      });
    }

    const updateData: any = {
      carrierId: updated.carrierId || null,
      mcOwnerId: updated.mcOwnerId || null,
      brokerName: updated.brokerName,
      brokerContact: updated.brokerContact,
      brokerPhone: updated.brokerPhone,
      brokerEmail: updated.brokerEmail,
      brokerMC: updated.brokerMC,
      pickupFacility: updated.pickupFacility,
      pickupAddress: updated.pickupAddress,
      pickupCity: updated.pickupCity,
      pickupState: updated.pickupState,
      pickupZip: updated.pickupZip,
      pickupDate: updated.pickupDate,
      pickupTime: updated.pickupTime,
      pickupApptNumber: updated.pickupApptNumber,
      deliveryFacility: updated.deliveryFacility,
      deliveryAddress: updated.deliveryAddress,
      deliveryCity: updated.deliveryCity,
      deliveryState: updated.deliveryState,
      deliveryZip: updated.deliveryZip,
      deliveryDate: updated.deliveryDate,
      deliveryTime: updated.deliveryTime,
      deliveryApptNumber: updated.deliveryApptNumber,
      commodity: updated.commodity,
      weight: updated.weight,
      miles: updated.miles,
      rate: updated.rate,
      totalFeePercent: updated.totalFeePercent,
      totalFeeAmount: updated.totalFeeAmount,
      dispatchFeePercent: updated.dispatchFeePercent,
      dispatchFeeAmount: updated.dispatchFeeAmount,
      mcOwnerFeeAmount: updated.mcOwnerFeeAmount,
      carrierNet: updated.carrierNet,
      ratePerMile: updated.ratePerMile,
      status: updated.status,
      notes: updated.notes,
      freeTimeMinutes: updated.freeTimeMinutes,
      detentionHours: updated.detentionHours,
      detentionRate: updated.detentionRate,
      detentionRevenue: updated.detentionRevenue,
      ratConUrl: updated.ratConUrl,
      bolUrl: updated.bolUrl,
      podUrl: updated.podUrl,
      updatedAt: new Date().toISOString(),
    };

    await db.update(schema.loads).set(updateData).where(eq(schema.loads.id, id));
    return await getLoad(id) || null;
  } catch (err) {
    console.error('Error updating load:', err);
    throw err;
  }
}

export async function deleteLoad(id: string): Promise<void> {
  try {
    const access = await requireLoadAccess(id);
    if (access.user.role === 'carrier') throw new Error('Carrier accounts cannot delete loads.');
    await db.delete(schema.loads).where(eq(schema.loads.id, id));
  } catch (err) {
    console.error('Error deleting load:', err);
    throw err;
  }
}

// â”€â”€â”€ Load Check-ins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCheckins(loadId: string): Promise<SonexLoadCheckin[]> {
  try {
    await requireLoadAccess(loadId);
    const list = await db.select().from(schema.loadCheckins).where(eq(schema.loadCheckins.loadId, loadId)).orderBy(schema.loadCheckins.timestamp);
    return list.map(c => ({
      id: c.id,
      loadId: c.loadId,
      event: c.event as any,
      timestamp: c.timestamp,
      notes: c.notes,
      loggedBy: c.loggedBy as any,
    }));
  } catch (err) {
    console.error('Error fetching check-ins:', err);
    return [];
  }
}

export async function recalculateDetention(loadId: string): Promise<void> {
  try {
    const loadRecord = await db.select().from(schema.loads).where(eq(schema.loads.id, loadId)).limit(1);
    if (loadRecord.length === 0) return;
    const load = loadRecord[0];
    
    const checkins = await db.select().from(schema.loadCheckins).where(eq(schema.loadCheckins.loadId, loadId));
    
    const arrivedPickup = checkins.find(c => c.event === 'arrived_pickup');
    const loadedDeparting = checkins.find(c => c.event === 'loaded_departing');
    const arrivedDelivery = checkins.find(c => c.event === 'arrived_delivery');
    const delivered = checkins.find(c => c.event === 'delivered');
    
    let pickupDwell = 0;
    if (arrivedPickup && loadedDeparting) {
      const start = new Date(arrivedPickup.timestamp).getTime();
      const end = new Date(loadedDeparting.timestamp).getTime();
      pickupDwell = Math.max(0, (end - start) / 60000);
    }
    
    let deliveryDwell = 0;
    if (arrivedDelivery && delivered) {
      const start = new Date(arrivedDelivery.timestamp).getTime();
      const end = new Date(delivered.timestamp).getTime();
      deliveryDwell = Math.max(0, (end - start) / 60000);
    }
    
    const freeTime = load.freeTimeMinutes;
    
    const pickupBillable = Math.max(0, pickupDwell - freeTime);
    const deliveryBillable = Math.max(0, deliveryDwell - freeTime);
    
    const totalBillableMinutes = pickupBillable + deliveryBillable;
    const rawHours = totalBillableMinutes / 60;
    const detentionHours = Math.round(rawHours * 100) / 100;
    const detentionRevenue = Math.round((rawHours * Number(load.detentionRate)) * 100) / 100;
    
    await db.update(schema.loads).set({
      detentionHours,
      detentionRevenue,
    }).where(eq(schema.loads.id, loadId));
  } catch (err) {
    console.error('Error recalculating detention:', err);
  }
}

export async function addCheckin(data: Omit<SonexLoadCheckin, 'id'>): Promise<SonexLoadCheckin> {
  try {
    const access = await requireLoadAccess(data.loadId);
    // Validate sequential core check-ins
    const coreEvents: CheckinEvent[] = ['arrived_pickup', 'loaded_departing', 'arrived_delivery', 'delivered'];
    if (coreEvents.includes(data.event)) {
      const existing = await db.select().from(schema.loadCheckins)
        .where(eq(schema.loadCheckins.loadId, data.loadId));
      const done = new Set(existing.map(c => c.event));
      
      const idx = coreEvents.indexOf(data.event);
      if (idx > 0) {
        const prevEvent = coreEvents[idx - 1];
        if (!done.has(prevEvent)) {
          throw new Error(`Cannot log "${data.event}" before completing "${prevEvent}".`);
        }
      }
      
      // Enforce file requirements
      if (data.event === 'loaded_departing' && !access.load.bolUrl) {
        throw new Error('BOL document is required before departing pickup.');
      }
      if (data.event === 'delivered' && !access.load.podUrl) {
        throw new Error('POD document is required before marking load as delivered.');
      }
    }

    const id = crypto.randomUUID();
    await db.insert(schema.loadCheckins).values({
      id,
      loadId: data.loadId,
      event: data.event,
      timestamp: data.timestamp || new Date().toISOString(),
      notes: data.notes,
      loggedBy: access.user.role,
    });

    // Recalculate detention on checkout
    if (data.event === 'loaded_departing' || data.event === 'delivered') {
      await recalculateDetention(data.loadId);
    }

    // Auto-update load status based on checkin event
    const statusMap: Partial<Record<CheckinEvent, LoadStatus>> = {
      arrived_pickup: 'dispatched',
      loaded_departing: 'in_transit',
      arrived_delivery: 'in_transit',
      delivered: 'delivered',
    };
    const nextStatus = statusMap[data.event];
    if (nextStatus) {
      await db.update(schema.loads).set({ status: nextStatus }).where(eq(schema.loads.id, data.loadId));
    }

    return {
      id,
      loadId: data.loadId,
      event: data.event,
      timestamp: data.timestamp || new Date().toISOString(),
      notes: data.notes,
      loggedBy: access.user.role,
    };
  } catch (err) {
    console.error('Error adding check-in:', err);
    throw err;
  }
}

export async function addCheckinSafely(data: Omit<SonexLoadCheckin, 'id'>): Promise<
  | { ok: true; checkin: SonexLoadCheckin }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, checkin: await addCheckin(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unable to save this check-in.',
    };
  }
}

// â”€â”€â”€ Cargo Photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCargoPhotos(loadId: string): Promise<SonexCargoPhoto[]> {
  try {
    await requireLoadAccess(loadId);
    const list = await db.select().from(schema.cargoPhotos).where(eq(schema.cargoPhotos.loadId, loadId)).orderBy(schema.cargoPhotos.uploadedAt);
    return list.map(p => ({
      id: p.id,
      loadId: p.loadId,
      url: p.url,
      stage: p.stage as any,
      caption: p.caption,
      uploadedAt: p.uploadedAt,
      uploadedBy: p.uploadedBy as any,
    }));
  } catch (err) {
    console.error('Error fetching cargo photos:', err);
    return [];
  }
}

export async function addCargoPhoto(data: Omit<SonexCargoPhoto, 'id'>): Promise<SonexCargoPhoto> {
  try {
    const access = await requireLoadAccess(data.loadId);
    const id = crypto.randomUUID();
    await db.insert(schema.cargoPhotos).values({
      id,
      loadId: data.loadId,
      url: data.url,
      stage: data.stage,
      caption: data.caption,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: access.user.role,
    });

    return {
      id,
      loadId: data.loadId,
      url: data.url,
      stage: data.stage,
      caption: data.caption,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: access.user.role,
    };
  } catch (err) {
    console.error('Error adding cargo photo:', err);
    throw err;
  }
}

// â”€â”€â”€ Carrier Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€



// â”€â”€â”€ Settlements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSettlements(carrierId?: string): Promise<SonexSettlement[]> {
  try {
    const user = carrierId ? await requireCarrierAccess(carrierId) : await requireWorkspaceUser();
    let list;
    if (carrierId) {
      list = await db.select().from(schema.settlements).where(eq(schema.settlements.carrierId, carrierId)).orderBy(desc(schema.settlements.generatedAt));
    } else if (user.role === 'mc_owner') {
      const scopedCarrierIds = (await getCarriers()).map(carrier => carrier.id);
      list = scopedCarrierIds.length
        ? await db.select().from(schema.settlements).where(inArray(schema.settlements.carrierId, scopedCarrierIds)).orderBy(desc(schema.settlements.generatedAt))
        : [];
    } else {
      list = await db.select().from(schema.settlements).orderBy(desc(schema.settlements.generatedAt));
    }
    return list.map(s => ({
      id: s.id,
      carrierId: s.carrierId,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      loadIds: s.loadIds.split(','),
      grossTotal: Number(s.grossTotal),
      feeTotal: Number(s.feeTotal),
      netTotal: Number(s.netTotal),
      generatedAt: s.generatedAt,
    }));
  } catch (err) {
    console.error('Error fetching settlements:', err);
    return [];
  }
}

export async function addSettlement(data: Omit<SonexSettlement, 'id'>): Promise<SonexSettlement> {
  try {
    const user = await requireCarrierAccess(data.carrierId);
    if (user.role === 'carrier') throw new Error('Carrier accounts cannot create settlements.');
    const id = crypto.randomUUID();
    const loadIdsStr = data.loadIds.join(',');

    await db.insert(schema.settlements).values({
      id,
      carrierId: data.carrierId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      loadIds: loadIdsStr,
      grossTotal: data.grossTotal,
      feeTotal: data.feeTotal,
      netTotal: data.netTotal,
      generatedAt: data.generatedAt || new Date().toISOString(),
    });

    return {
      id,
      carrierId: data.carrierId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      loadIds: data.loadIds,
      grossTotal: data.grossTotal,
      feeTotal: data.feeTotal,
      netTotal: data.netTotal,
      generatedAt: data.generatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error adding settlement:', err);
    throw err;
  }
}

// â”€â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSettings(): Promise<SonexSettings> {
  try {
    await requireAdminUser();
    const results = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
    if (results.length === 0) {
      return {
        companyName: 'Sonex Logistics LLC',
        companyAddress: '525 Randall Ave Ste 100',
        companyCity: 'Cheyenne',
        companyState: 'WY',
        companyZip: '82001',
        companyEmail: 'dispatch@sonexlogistics.com',
        companyPhone: '(346) 421-2681',
        defaultDispatchFeePercent: 10,
        adminUsers: [],
      };
    }
    const data = results[0];
    return {
      companyName: data.companyName,
      companyAddress: data.companyAddress || '',
      companyCity: data.companyCity || '',
      companyState: data.companyState || '',
      companyZip: data.companyZip || '',
      companyEmail: data.companyEmail || '',
      companyPhone: data.companyPhone || '',
      defaultDispatchFeePercent: Number(data.defaultDispatchFeePercent),
      adminUsers: JSON.parse(data.adminUsers || '[]'),
    };
  } catch (err) {
    console.error('Error fetching settings:', err);
    return {
      companyName: 'Sonex Logistics LLC',
      companyAddress: '525 Randall Ave Ste 100',
      companyCity: 'Cheyenne',
      companyState: 'WY',
      companyZip: '82001',
      companyEmail: 'dispatch@sonexlogistics.com',
      companyPhone: '(346) 421-2681',
      defaultDispatchFeePercent: 10,
      adminUsers: [],
    };
  }
}

export async function updateSettings(data: Partial<SonexSettings>): Promise<SonexSettings> {
  try {
    await requireAdminUser();
    const current = await getSettings();
    const updated = { ...current, ...data };

    const updateData: any = {
      companyName: updated.companyName,
      companyAddress: updated.companyAddress,
      companyCity: updated.companyCity,
      companyState: updated.companyState,
      companyZip: updated.companyZip,
      companyEmail: updated.companyEmail,
      companyPhone: updated.companyPhone,
      defaultDispatchFeePercent: updated.defaultDispatchFeePercent,
      adminUsers: JSON.stringify(updated.adminUsers),
      updatedAt: new Date().toISOString(),
    };

    await db.update(schema.settings).set(updateData).where(eq(schema.settings.id, 1));
    return await getSettings();
  } catch (err) {
    console.error('Error updating settings:', err);
    throw err;
  }
}

// â”€â”€â”€ Analytics Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CarrierStats {
  totalLoads: number;
  completedLoads: number;
  activeLoads: number;
  lifetimeGross: number;
  lifetimeFees: number;
  lifetimeNet: number;
  avgRPM: number;
}

export async function getCarrierStats(carrierId: string): Promise<CarrierStats> {
  try {
    await requireCarrierAccess(carrierId);
    const [totalRes] = await db.select({ count: count() }).from(schema.loads).where(eq(schema.loads.carrierId, carrierId));
    const [completedRes] = await db.select({ count: count() }).from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid'])));
    const [activeRes] = await db.select({ count: count() }).from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), inArray(schema.loads.status, ['booked', 'dispatched', 'in_transit'])));
    
    const [lifetimeRes] = await db.select({
      gross: sum(schema.loads.rate),
      fees: sum(schema.loads.totalFeeAmount),
      avgRpm: avg(schema.loads.ratePerMile)
    }).from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid'])));

    const gross = Number(lifetimeRes?.gross || 0);
    const fees = Number(lifetimeRes?.fees || 0);
    const avgRpm = Number(lifetimeRes?.avgRpm || 0);

    return {
      totalLoads: totalRes?.count || 0,
      completedLoads: completedRes?.count || 0,
      activeLoads: activeRes?.count || 0,
      lifetimeGross: gross,
      lifetimeFees: fees,
      lifetimeNet: Math.round((gross - fees) * 100) / 100,
      avgRPM: Math.round(avgRpm * 100) / 100,
    };
  } catch (err) {
    console.error('Error getting carrier stats:', err);
    return {
      totalLoads: 0,
      completedLoads: 0,
      activeLoads: 0,
      lifetimeGross: 0,
      lifetimeFees: 0,
      lifetimeNet: 0,
      avgRPM: 0,
    };
  }
}

export interface DashboardStats {
  activeCarriers: number;
  loadsInProgress: number;
  loadsCompletedThisWeek: number;
  grossThisMonth: number;
  feesThisMonth: number;
  avgRPMThisMonth: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    await requireWorkspaceUser();
    const [scopedLoads, scopedCarriers] = await Promise.all([getLoads(), getCarriers()]);
    return getDashboardStatsInMemory(scopedLoads, scopedCarriers);
  } catch (err) {
    console.error('Error getting dashboard stats:', err);
    return {
      activeCarriers: 0,
      loadsInProgress: 0,
      loadsCompletedThisWeek: 0,
      grossThisMonth: 0,
      feesThisMonth: 0,
      avgRPMThisMonth: 0,
    };
  }
}

export async function getTodayActivity(): Promise<{ pickups: SonexLoad[]; deliveries: SonexLoad[] }> {
  await requireWorkspaceUser();
  const loads = await getLoads();
  return buildTodayActivity(loads);
}

function getDashboardStatsInMemory(loads: SonexLoad[], carriers: SonexCarrier[]): DashboardStats {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString();

  const activeCarriers = carriers.filter(c => c.status === 'active').length;
  const loadsInProgress = loads.filter(l => ['booked', 'dispatched', 'in_transit'].includes(l.status)).length;
  
  const completedStatuses = ['delivered', 'pod_received', 'invoiced', 'paid'];
  
  const weekCompletedLoads = loads.filter(l => 
    completedStatuses.includes(l.status) && l.updatedAt >= weekStartStr
  );
  const loadsCompletedThisWeek = weekCompletedLoads.length;

  const monthCompletedLoads = loads.filter(l => 
    completedStatuses.includes(l.status) && l.updatedAt >= monthStartStr
  );

  const grossThisMonth = monthCompletedLoads.reduce((sum, l) => sum + l.rate, 0);
  const feesThisMonth = monthCompletedLoads.reduce((sum, l) => sum + l.dispatchFeeAmount, 0);
  
  const rpmSum = monthCompletedLoads.reduce((sum, l) => sum + l.ratePerMile, 0);
  const avgRPMThisMonth = monthCompletedLoads.length > 0 ? rpmSum / monthCompletedLoads.length : 0;

  return {
    activeCarriers,
    loadsInProgress,
    loadsCompletedThisWeek,
    grossThisMonth: Math.round(grossThisMonth * 100) / 100,
    feesThisMonth: Math.round(feesThisMonth * 100) / 100,
    avgRPMThisMonth: Math.round(avgRPMThisMonth * 100) / 100,
  };
}

function buildWeeklyDataServer(loads: SonexLoad[]) {
  const weeks: { label: string; gross: number; fees: number }[] = [];
  const now = new Date();

  // Pre-format ISO date strings for all loads to avoid repeatedly parsing
  const formattedLoads = loads.map(l => ({
    ...l,
    pickupDateOnly: l.pickupDate.split('T')[0]
  }));

  for (let i = 5; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1 - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const weekLoads = formattedLoads.filter(load => 
      load.pickupDateOnly >= startStr && load.pickupDateOnly <= endStr
    );

    weeks.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      gross: Math.round(weekLoads.reduce((sum, load) => sum + load.rate, 0)),
      fees: Math.round(weekLoads.reduce((sum, load) => sum + load.dispatchFeeAmount, 0)),
    });
  }

  return weeks;
}

export async function getDashboardCombinedData() {
  try {
    await requireWorkspaceUser();
    const [loads, carriers] = await Promise.all([
      getLoads(),
      getCarriers(),
    ]);

    const carrierMap = new Map(carriers.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

    // Compute stats and today's activity purely in-memory
    const stats = getDashboardStatsInMemory(loads, carriers);
    const activityRaw = buildTodayActivity(loads);

    // Pre-map carrier name directly onto active loads
    const activity = {
      pickups: activityRaw.pickups.map(l => ({
        ...l,
        carrierName: carrierMap.get(l.carrierId) || 'Unknown'
      })),
      deliveries: activityRaw.deliveries.map(l => ({
        ...l,
        carrierName: carrierMap.get(l.carrierId) || 'Unknown'
      }))
    };

    // Calculate weekly data
    const weeklyData = buildWeeklyDataServer(loads);

    // Calculate queue counts
    const podNeeded = loads.filter(load => load.status === 'delivered' && !load.podUrl).length;
    const invoiceReady = loads.filter(load => ['pod_received', 'invoiced', 'paid'].includes(load.status)).length;

    return {
      stats,
      activity,
      weeklyData,
      podNeeded,
      invoiceReady
    };
  } catch (err) {
    console.error('Error getting dashboard combined data:', err);
    throw err;
  }
}

// â”€â”€â”€ CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function exportLoadsCSV(loads: SonexLoad[], carriers: SonexCarrier[]): Promise<string> {
  const user = await requireWorkspaceUser();
  if (user.role === 'mc_owner') {
    const permittedCarrierIds = new Set((await getCarriers()).map(carrier => carrier.id));
    if (loads.some(load => !permittedCarrierIds.has(load.carrierId)) || carriers.some(carrier => !permittedCarrierIds.has(carrier.id))) {
      throw new Error('Export contains records outside your MC authority.');
    }
  }
  const carrierMap = new Map(carriers.map(c => [c.id, `${c.firstName} ${c.lastName}`]));
  const headers = [
    'Load #', 'Date', 'Carrier', 'Broker', 'Pickup State', 'Delivery State',
    'Commodity', 'Weight (lbs)', 'Miles', 'Rate ($)', 'RPM ($/mi)',
    'Dispatch Fee (%)', 'Dispatch Fee ($)', 'Carrier Net ($)', 'Status',
  ];
  const rows = loads.map(l => [
    l.loadNumber,
    l.pickupDate,
    carrierMap.get(l.carrierId) || l.carrierId,
    l.brokerName,
    l.pickupState,
    l.deliveryState,
    l.commodity,
    l.weight,
    l.miles,
    l.rate.toFixed(2),
    l.ratePerMile.toFixed(2),
    l.dispatchFeePercent,
    l.dispatchFeeAmount.toFixed(2),
    l.carrierNet.toFixed(2),
    l.status,
  ]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

// â”€â”€â”€ Database Reset Trigger â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
