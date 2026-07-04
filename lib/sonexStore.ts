// â”€â”€â”€ Sonex Dispatch Hub â€” Drizzle Turso/SQLite Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
'use server';

import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, desc, and, inArray, sql, count, sum, avg, gte } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import crypto from 'crypto';
import { getCurrentUserAction } from './authActions';


import {
  SonexCarrier, SonexLoad, SonexLoadCheckin, SonexCargoPhoto,
  SonexDocument, SonexSettlement, SonexSettings,
  DocType, computeLoadFinancials, LoadStatus, CheckinEvent,
} from './sonexTypes';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


async function generateLoadNumber(existingLoads: SonexLoad[]): Promise<string> {
  const year = new Date().getFullYear();
  const existing = existingLoads
    .map(l => parseInt(l.loadNumber.split('-').pop() || '0'))
    .filter(n => !isNaN(n));
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
    dispatchFeePercent: Number(l.dispatchFeePercent),
    dispatchFeeAmount: Number(l.dispatchFeeAmount),
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
    const list = await db.select().from(schema.carriers).orderBy(desc(schema.carriers.joinedAt));
    return list.map(mapDbCarrier);
  } catch (err) {
    console.error('Error fetching carriers:', err);
    return [];
  }
}

export async function getCarrier(id: string): Promise<SonexCarrier | undefined> {
  try {
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

export async function addCarrier(
  data: Omit<SonexCarrier, 'id' | 'joinedAt' | 'updatedAt'> & { portalPassword?: string }
): Promise<SonexCarrier> {
  try {
    const { portalPassword, ...carrierData } = data as any;
    const carrierId = crypto.randomUUID();

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
      isLeasedMC: carrierData.isLeasedMC,
      mcHolderName: carrierData.mcHolderName,
      mcHolderMC: carrierData.mcHolderMC,
      insuranceType: carrierData.insuranceType,
      insuranceCompany: carrierData.insuranceCompany,
      insurancePolicyNumber: carrierData.insurancePolicyNumber,
      dispatchFeePercent: carrierData.dispatchFeePercent,
      status: carrierData.status,
      notes: carrierData.notes,
      portalEmail: carrierData.portalEmail,
    });

    // Create portal login if email + password provided
    if (carrierData.portalEmail && portalPassword) {
      const displayName = `${carrierData.firstName} ${carrierData.lastName}`;
      const result = await createCarrierPortalUser(carrierId, carrierData.portalEmail, portalPassword, displayName);
      if (!result.success) {
        console.warn('Carrier created but portal login failed:', result.error);
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
    if (data.dispatchFeePercent !== undefined) updateData.dispatchFeePercent = data.dispatchFeePercent;
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

export async function deleteCarrier(id: string): Promise<void> {
  try {
    await db.delete(schema.carriers).where(eq(schema.carriers.id, id));
  } catch (err) {
    console.error('Error deleting carrier:', err);
    throw err;
  }
}

// â”€â”€â”€ Loads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getLoads(): Promise<SonexLoad[]> {
  try {
    const list = await db.select().from(schema.loads).orderBy(desc(schema.loads.createdAt));
    return list.map(mapDbLoad);
  } catch (err) {
    console.error('Error fetching loads:', err);
    return [];
  }
}

export async function getLoad(id: string): Promise<SonexLoad | undefined> {
  try {
    const results = await db.select().from(schema.loads).where(eq(schema.loads.id, id)).limit(1);
    if (results.length === 0) return undefined;
    return mapDbLoad(results[0]);
  } catch (err) {
    console.error('Error fetching load:', err);
    return undefined;
  }
}

export async function getLoadsByCarrier(carrierId: string): Promise<SonexLoad[]> {
  try {
    const list = await db.select().from(schema.loads).where(eq(schema.loads.carrierId, carrierId)).orderBy(desc(schema.loads.createdAt));
    return list.map(mapDbLoad);
  } catch (err) {
    console.error('Error fetching loads by carrier:', err);
    return [];
  }
}

export async function addLoad(
  data: Omit<SonexLoad, 'id' | 'loadNumber' | 'dispatchFeeAmount' | 'carrierNet' | 'ratePerMile' | 'createdAt' | 'updatedAt' | 'freeTimeMinutes' | 'detentionHours' | 'detentionRate' | 'detentionRevenue'> & {
    freeTimeMinutes?: number;
    detentionRate?: number;
  }
): Promise<SonexLoad> {
  try {
    const { dispatchFeeAmount, carrierNet, ratePerMile } = await computeLoadFinancials(data.rate, data.miles, data.dispatchFeePercent);
    const existing = await getLoads();
    const loadNumber = await generateLoadNumber(existing);
    const id = crypto.randomUUID();

    await db.insert(schema.loads).values({
      id,
      loadNumber,
      carrierId: data.carrierId || null,
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
      dispatchFeePercent: data.dispatchFeePercent,
      dispatchFeeAmount,
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
    const current = await getLoad(id);
    if (!current) return null;

    const updated = { ...current, ...data };
    
    if (data.rate !== undefined || data.miles !== undefined || data.dispatchFeePercent !== undefined) {
      const { dispatchFeeAmount, carrierNet, ratePerMile } = await computeLoadFinancials(
        updated.rate, updated.miles, updated.dispatchFeePercent
      );
      updated.dispatchFeeAmount = dispatchFeeAmount;
      updated.carrierNet = carrierNet;
      updated.ratePerMile = ratePerMile;
    }

    if (data.status && data.status !== current.status) {
      const currentUser = await getCurrentUserAction();
      const isAdmin = currentUser?.role === 'admin';

      if (!isAdmin) {
        const allowedTransitions: Record<LoadStatus, LoadStatus[]> = {
          booked: ['dispatched'],
          dispatched: ['booked', 'in_transit'],
          in_transit: ['dispatched', 'delivered'],
          delivered: ['in_transit', 'pod_received'],
          pod_received: ['delivered', 'invoiced'],
          invoiced: ['pod_received', 'paid'],
          paid: ['invoiced'],
        };
        
        const allowed = allowedTransitions[current.status as LoadStatus] || [];
        if (!allowed.includes(data.status)) {
          throw new Error(`Invalid status transition from "${current.status}" to "${data.status}".`);
        }
      }

      // Log audit checkin for status change
      await db.insert(schema.loadCheckins).values({
        id: crypto.randomUUID(),
        loadId: id,
        event: `status_${data.status}` as any,
        timestamp: new Date().toISOString(),
        notes: `Status transitioned from "${current.status}" to "${data.status}".`,
        loggedBy: 'admin',
      });
    }

    const updateData: any = {
      carrierId: updated.carrierId || null,
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
      dispatchFeePercent: updated.dispatchFeePercent,
      dispatchFeeAmount: updated.dispatchFeeAmount,
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
    await db.delete(schema.loads).where(eq(schema.loads.id, id));
  } catch (err) {
    console.error('Error deleting load:', err);
    throw err;
  }
}

// â”€â”€â”€ Load Check-ins â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCheckins(loadId: string): Promise<SonexLoadCheckin[]> {
  try {
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
      const loadRecord = await db.select().from(schema.loads)
        .where(eq(schema.loads.id, data.loadId))
        .limit(1);
      
      if (loadRecord.length > 0) {
        if (data.event === 'loaded_departing' && !loadRecord[0].bolUrl) {
          throw new Error('BOL document is required before departing pickup.');
        }
        if (data.event === 'delivered' && !loadRecord[0].podUrl) {
          throw new Error('POD document is required before marking load as delivered.');
        }
      }
    }

    const id = crypto.randomUUID();
    await db.insert(schema.loadCheckins).values({
      id,
      loadId: data.loadId,
      event: data.event,
      timestamp: data.timestamp || new Date().toISOString(),
      notes: data.notes,
      loggedBy: data.loggedBy,
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
      loggedBy: data.loggedBy,
    };
  } catch (err) {
    console.error('Error adding check-in:', err);
    throw err;
  }
}

// â”€â”€â”€ Cargo Photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getCargoPhotos(loadId: string): Promise<SonexCargoPhoto[]> {
  try {
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
    const id = crypto.randomUUID();
    await db.insert(schema.cargoPhotos).values({
      id,
      loadId: data.loadId,
      url: data.url,
      stage: data.stage,
      caption: data.caption,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: data.uploadedBy,
    });

    return {
      id,
      loadId: data.loadId,
      url: data.url,
      stage: data.stage,
      caption: data.caption,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: data.uploadedBy,
    };
  } catch (err) {
    console.error('Error adding cargo photo:', err);
    throw err;
  }
}

// â”€â”€â”€ Carrier Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€



export async function getDocuments(carrierId?: string, includeHistory = false): Promise<SonexDocument[]> {
  try {
    let list;
    const conditions = [];
    if (carrierId) {
      conditions.push(eq(schema.carrierDocuments.carrierId, carrierId));
    }
    if (!includeHistory) {
      conditions.push(eq(schema.carrierDocuments.isCurrent, true));
    }

    if (conditions.length > 0) {
      list = await db.select().from(schema.carrierDocuments)
        .where(and(...conditions))
        .orderBy(desc(schema.carrierDocuments.uploadedAt));
    } else {
      list = await db.select().from(schema.carrierDocuments)
        .orderBy(desc(schema.carrierDocuments.uploadedAt));
    }
    return list.map(d => ({
      id: d.id,
      carrierId: d.carrierId,
      docType: d.docType as DocType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      filePath: d.filePath || '',
      expirationDate: d.expirationDate || undefined,
      uploadedAt: d.uploadedAt,
      uploadedBy: d.uploadedBy as any,
      notes: d.notes || undefined,
    }));
  } catch (err) {
    console.error('Error fetching documents:', err);
    return [];
  }
}

export async function addDocument(data: Omit<SonexDocument, 'id'>): Promise<SonexDocument> {
  try {
    // Compliance history preservation: mark all older versions as not current
    await db.update(schema.carrierDocuments)
      .set({ isCurrent: false })
      .where(and(
        eq(schema.carrierDocuments.carrierId, data.carrierId),
        eq(schema.carrierDocuments.docType, data.docType)
      ));

    // Insert new version as current
    const docId = crypto.randomUUID();
    await db.insert(schema.carrierDocuments).values({
      id: docId,
      carrierId: data.carrierId,
      docType: data.docType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      filePath: data.filePath,
      expirationDate: data.expirationDate || null,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: data.uploadedBy,
      notes: data.notes || '',
      isCurrent: true,
    });

    return {
      id: docId,
      carrierId: data.carrierId,
      docType: data.docType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      filePath: data.filePath,
      expirationDate: data.expirationDate || undefined,
      uploadedAt: data.uploadedAt || new Date().toISOString(),
      uploadedBy: data.uploadedBy,
      notes: data.notes || undefined,
    };
  } catch (err) {
    console.error('Error adding document:', err);
    throw err;
  }
}

export async function deleteDocument(id: string): Promise<void> {
  try {
    await db.delete(schema.carrierDocuments).where(eq(schema.carrierDocuments.id, id));
  } catch (err) {
    console.error('Error deleting document:', err);
    throw err;
  }
}

export async function getExpiringDocuments(withinDays = 30): Promise<SonexDocument[]> {
  const docs = await getDocuments();
  const now = new Date();
  return docs.filter(d => {
    if (!d.expirationDate) return false;
    const exp = new Date(d.expirationDate);
    const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= withinDays;
  }).sort((a, b) => {
    const da = new Date(a.expirationDate!).getTime();
    const db = new Date(b.expirationDate!).getTime();
    return da - db;
  });
}


// â”€â”€â”€ Settlements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSettlements(carrierId?: string): Promise<SonexSettlement[]> {
  try {
    let list;
    if (carrierId) {
      list = await db.select().from(schema.settlements).where(eq(schema.settlements.carrierId, carrierId)).orderBy(desc(schema.settlements.generatedAt));
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
    const [totalRes] = await db.select({ count: count() }).from(schema.loads).where(eq(schema.loads.carrierId, carrierId));
    const [completedRes] = await db.select({ count: count() }).from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid'])));
    const [activeRes] = await db.select({ count: count() }).from(schema.loads).where(and(eq(schema.loads.carrierId, carrierId), inArray(schema.loads.status, ['booked', 'dispatched', 'in_transit'])));
    
    const [lifetimeRes] = await db.select({
      gross: sum(schema.loads.rate),
      fees: sum(schema.loads.dispatchFeeAmount),
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
    const now = new Date();
    const dayOfWeek = now.getDay();
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString();

    const [carriersRes] = await db.select({ count: count() }).from(schema.carriers).where(eq(schema.carriers.status, 'active'));
    const [inProgressRes] = await db.select({ count: count() }).from(schema.loads).where(inArray(schema.loads.status, ['booked', 'dispatched', 'in_transit']));
    const [weekCompletedRes] = await db.select({ count: count() }).from(schema.loads).where(and(
      inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid']),
      gte(schema.loads.updatedAt, weekStartStr)
    ));

    const [monthCompletedRes] = await db.select({
      gross: sum(schema.loads.rate),
      fees: sum(schema.loads.dispatchFeeAmount),
      avgRpm: avg(schema.loads.ratePerMile)
    }).from(schema.loads).where(and(
      inArray(schema.loads.status, ['delivered', 'pod_received', 'invoiced', 'paid']),
      gte(schema.loads.updatedAt, monthStartStr)
    ));

    const grossThisMonth = Number(monthCompletedRes?.gross || 0);
    const feesThisMonth = Number(monthCompletedRes?.fees || 0);
    const avgRpmThisMonth = Number(monthCompletedRes?.avgRpm || 0);

    return {
      activeCarriers: carriersRes?.count || 0,
      loadsInProgress: inProgressRes?.count || 0,
      loadsCompletedThisWeek: weekCompletedRes?.count || 0,
      grossThisMonth: Math.round(grossThisMonth * 100) / 100,
      feesThisMonth: Math.round(feesThisMonth * 100) / 100,
      avgRPMThisMonth: Math.round(avgRpmThisMonth * 100) / 100,
    };
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

function getTodayActivityInMemory(loads: SonexLoad[]): { pickups: SonexLoad[]; deliveries: SonexLoad[] } {
  const today = new Date().toISOString().split('T')[0];
  return {
    pickups: loads.filter(l => l.pickupDate === today && ['booked', 'dispatched', 'in_transit'].includes(l.status)),
    deliveries: loads.filter(l => l.deliveryDate === today && ['in_transit'].includes(l.status)),
  };
}

export async function getTodayActivity(): Promise<{ pickups: SonexLoad[]; deliveries: SonexLoad[] }> {
  const loads = await getLoads();
  return getTodayActivityInMemory(loads);
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
    const [loads, carriers, expiringDocs] = await Promise.all([
      getLoads(),
      getCarriers(),
      getExpiringDocuments(30)
    ]);

    const carrierMap = new Map(carriers.map(c => [c.id, `${c.firstName} ${c.lastName}`]));

    // Compute stats and today's activity purely in-memory
    const stats = getDashboardStatsInMemory(loads, carriers);
    const activityRaw = getTodayActivityInMemory(loads);

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
      invoiceReady,
      expiringDocs
    };
  } catch (err) {
    console.error('Error getting dashboard combined data:', err);
    throw err;
  }
}

// â”€â”€â”€ CSV Export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function exportLoadsCSV(loads: SonexLoad[], carriers: SonexCarrier[]): Promise<string> {
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

export async function resetStore(): Promise<void> {
  // Clear tables and re-run seeder logic programmatically
  try {
    console.log('Resetting database store...');
    await db.delete(schema.loadCheckins);
    await db.delete(schema.cargoPhotos);
    await db.delete(schema.carrierDocuments);
    await db.delete(schema.settlements);
    await db.delete(schema.loads);
    await db.delete(schema.carrierDrivers);
    await db.delete(schema.carrierEquipment);
    await db.delete(schema.users);
    await db.delete(schema.carriers);

    const hasher = new (require('lucia').Scrypt || require('crypto'))(); 
    // Wait, let's just trigger our seed script using child process or re-seed natively in server side code!
    // Since we have the seed values, we can copy the seeder inserts here to run natively on the server!
    const { hash } = require('@node-rs/argon2');
    const adminPasswordHash = await hash('sonex2026');
    const carrierPasswordHash = await hash('carrier2026');

    // Insert Settings
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
    ]);

    const user1Id = 'a1111111-1111-1111-1111-111111111111';
    const user2Id = 'a1111111-1111-1111-1111-111111111112';
    const user3Id = 'a1111111-1111-1111-1111-111111111113';

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
    ]);

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
    ]);

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
    ]);

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
    ]);

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

    console.log('Database reset complete.');
  } catch (err) {
    console.error('Error resetting database store:', err);
    throw err;
  }
}

