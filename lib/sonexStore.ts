// ─── Sonex Dispatch Hub — Supabase Store ──────────────────────────────────────
'use client';

import type {
  SonexCarrier, SonexLoad, SonexLoadCheckin, SonexCargoPhoto,
  SonexDocument, SonexMessage, SonexSettlement, SonexSettings,
  DocType,
} from './sonexTypes';
import { supabase } from './supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function computeLoadFinancials(rate: number, miles: number, feePercent: number) {
  const dispatchFeeAmount = Math.round(rate * (feePercent / 100) * 100) / 100;
  const carrierNet = Math.round((rate - dispatchFeeAmount) * 100) / 100;
  const ratePerMile = miles > 0 ? Math.round((rate / miles) * 100) / 100 : 0;
  return { dispatchFeeAmount, carrierNet, ratePerMile };
}

function generateLoadNumber(existingLoads: SonexLoad[]): string {
  const year = new Date().getFullYear();
  const existing = existingLoads
    .map(l => parseInt(l.loadNumber.split('-').pop() || '0'))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `SNX-${year}-${String(next).padStart(3, '0')}`;
}

// ─── DB Mappers ───────────────────────────────────────────────────────────────

function mapDbCarrier(c: any): SonexCarrier {
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email,
    phone: c.phone,
    address: c.address || undefined,
    city: c.city || undefined,
    state: c.state || undefined,
    zip: c.zip || undefined,
    equipmentType: c.equipment_type,
    truckYear: c.truck_year,
    truckMake: c.truck_make,
    truckModel: c.truck_model,
    truckVin: c.truck_vin,
    truckPlate: c.truck_plate,
    truckState: c.truck_state,
    weightCapacity: c.weight_capacity,
    hasTrailer: c.has_trailer,
    trailerType: c.trailer_type || undefined,
    trailerVin: c.trailer_vin || undefined,
    trailerPlate: c.trailer_plate || undefined,
    trailerState: c.trailer_state || undefined,
    trailerLength: c.trailer_length || undefined,
    hasOwnAuthority: c.has_own_authority,
    mcNumber: c.mc_number || undefined,
    dotNumber: c.dot_number || undefined,
    isLeasedMC: c.is_leased_mc,
    mcHolderName: c.mc_holder_name || undefined,
    mcHolderMC: c.mc_holder_mc || undefined,
    insuranceType: c.insurance_type,
    insuranceCompany: c.insurance_company || undefined,
    insurancePolicyNumber: c.insurance_policy_number || undefined,
    dispatchFeePercent: Number(c.dispatch_fee_percent),
    status: c.status,
    notes: c.notes,
    portalEmail: c.portal_email,
    joinedAt: c.joined_at,
    updatedAt: c.updated_at,
  };
}

function mapToDbCarrier(c: Partial<SonexCarrier>): any {
  return {
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    state: c.state,
    zip: c.zip,
    equipment_type: c.equipmentType,
    truck_year: c.truckYear,
    truck_make: c.truckMake,
    truck_model: c.truckModel,
    truck_vin: c.truckVin,
    truck_plate: c.truckPlate,
    truck_state: c.truckState,
    weight_capacity: c.weightCapacity,
    has_trailer: c.hasTrailer,
    trailer_type: c.trailerType,
    trailer_vin: c.trailerVin,
    trailer_plate: c.trailerPlate,
    trailer_state: c.trailerState,
    trailer_length: c.trailerLength,
    has_own_authority: c.hasOwnAuthority,
    mc_number: c.mcNumber,
    dot_number: c.dotNumber,
    is_leased_mc: c.isLeasedMC,
    mc_holder_name: c.mcHolderName,
    mc_holder_mc: c.mcHolderMC,
    insurance_type: c.insuranceType,
    insurance_company: c.insuranceCompany,
    insurance_policy_number: c.insurancePolicyNumber,
    dispatch_fee_percent: c.dispatchFeePercent,
    status: c.status,
    notes: c.notes,
    portal_email: c.portalEmail,
  };
}

function mapDbLoad(l: any): SonexLoad {
  return {
    id: l.id,
    loadNumber: l.load_number,
    carrierId: l.carrier_id,
    brokerName: l.broker_name,
    brokerContact: l.broker_contact,
    brokerPhone: l.broker_phone,
    brokerEmail: l.broker_email || undefined,
    brokerMC: l.broker_mc || undefined,
    pickupFacility: l.pickup_facility,
    pickupAddress: l.pickup_address,
    pickupCity: l.pickup_city,
    pickupState: l.pickup_state,
    pickupZip: l.pickup_zip,
    pickupDate: l.pickup_date,
    pickupTime: l.pickup_time,
    pickupApptNumber: l.pickup_appt_number || undefined,
    deliveryFacility: l.delivery_facility,
    deliveryAddress: l.delivery_address,
    deliveryCity: l.delivery_city,
    deliveryState: l.delivery_state,
    deliveryZip: l.delivery_zip,
    deliveryDate: l.delivery_date,
    deliveryTime: l.delivery_time,
    deliveryApptNumber: l.delivery_appt_number || undefined,
    commodity: l.commodity,
    weight: l.weight,
    miles: Number(l.miles),
    rate: Number(l.rate),
    dispatchFeePercent: Number(l.dispatch_fee_percent),
    dispatchFeeAmount: Number(l.dispatch_fee_amount),
    carrierNet: Number(l.carrier_net),
    ratePerMile: Number(l.rate_per_mile),
    status: l.status,
    ratConUrl: l.rat_con_url || undefined,
    bolUrl: l.bol_url || undefined,
    podUrl: l.pod_url || undefined,
    notes: l.notes,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

// ─── Carriers ─────────────────────────────────────────────────────────────────

export async function getCarriers(): Promise<SonexCarrier[]> {
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .order('joined_at', { ascending: false });
  if (error) {
    console.error('Error fetching carriers:', error);
    return [];
  }
  return (data || []).map(mapDbCarrier);
}

export async function getCarrier(id: string): Promise<SonexCarrier | undefined> {
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Error fetching carrier:', error);
    return undefined;
  }
  return mapDbCarrier(data);
}

export async function addCarrier(data: Omit<SonexCarrier, 'id' | 'joinedAt' | 'updatedAt'>): Promise<SonexCarrier> {
  const { data: inserted, error } = await supabase
    .from('carriers')
    .insert([mapToDbCarrier(data)])
    .select()
    .single();
  if (error) {
    console.error('Error adding carrier:', error);
    throw error;
  }
  return mapDbCarrier(inserted);
}

export async function updateCarrier(id: string, data: Partial<SonexCarrier>): Promise<SonexCarrier | null> {
  const dbData = mapToDbCarrier(data);
  dbData.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('carriers')
    .update(dbData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating carrier:', error);
    return null;
  }
  return mapDbCarrier(updated);
}

export async function deleteCarrier(id: string): Promise<void> {
  const { error } = await supabase
    .from('carriers')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting carrier:', error);
    throw error;
  }
}

// ─── Loads ────────────────────────────────────────────────────────────────────

export async function getLoads(): Promise<SonexLoad[]> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching loads:', error);
    return [];
  }
  return (data || []).map(mapDbLoad);
}

export async function getLoad(id: string): Promise<SonexLoad | undefined> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Error fetching load:', error);
    return undefined;
  }
  return mapDbLoad(data);
}

export async function getLoadsByCarrier(carrierId: string): Promise<SonexLoad[]> {
  const { data, error } = await supabase
    .from('loads')
    .select('*')
    .eq('carrier_id', carrierId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching loads by carrier:', error);
    return [];
  }
  return (data || []).map(mapDbLoad);
}

export async function addLoad(data: Omit<SonexLoad, 'id' | 'loadNumber' | 'dispatchFeeAmount' | 'carrierNet' | 'ratePerMile' | 'createdAt' | 'updatedAt'>): Promise<SonexLoad> {
  const { dispatchFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(data.rate, data.miles, data.dispatchFeePercent);
  
  const loads = await getLoads();
  const loadNumber = generateLoadNumber(loads);

  const dbLoad = {
    load_number: loadNumber,
    carrier_id: data.carrierId,
    broker_name: data.brokerName,
    broker_contact: data.brokerContact,
    broker_phone: data.brokerPhone,
    broker_email: data.brokerEmail,
    broker_mc: data.brokerMC,
    pickup_facility: data.pickupFacility,
    pickup_address: data.pickupAddress,
    pickup_city: data.pickupCity,
    pickup_state: data.pickupState,
    pickup_zip: data.pickupZip,
    pickup_date: data.pickupDate,
    pickup_time: data.pickupTime,
    pickup_appt_number: data.pickupApptNumber,
    delivery_facility: data.deliveryFacility,
    delivery_address: data.deliveryAddress,
    delivery_city: data.deliveryCity,
    delivery_state: data.deliveryState,
    delivery_zip: data.deliveryZip,
    delivery_date: data.deliveryDate,
    delivery_time: data.deliveryTime,
    delivery_appt_number: data.deliveryApptNumber,
    commodity: data.commodity,
    weight: data.weight,
    miles: data.miles,
    rate: data.rate,
    dispatch_fee_percent: data.dispatchFeePercent,
    dispatch_fee_amount: dispatchFeeAmount,
    carrier_net: carrierNet,
    rate_per_mile: ratePerMile,
    status: data.status,
    notes: data.notes,
    rat_con_url: data.ratConUrl,
    bol_url: data.bolUrl,
    pod_url: data.podUrl,
  };

  const { data: inserted, error } = await supabase
    .from('loads')
    .insert([dbLoad])
    .select()
    .single();

  if (error) {
    console.error('Error adding load:', error);
    throw error;
  }
  return mapDbLoad(inserted);
}

export async function updateLoad(id: string, data: Partial<SonexLoad>): Promise<SonexLoad | null> {
  const current = await getLoad(id);
  if (!current) return null;

  const updated = { ...current, ...data };
  
  if (data.rate !== undefined || data.miles !== undefined || data.dispatchFeePercent !== undefined) {
    const { dispatchFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(
      updated.rate, updated.miles, updated.dispatchFeePercent
    );
    updated.dispatchFeeAmount = dispatchFeeAmount;
    updated.carrierNet = carrierNet;
    updated.ratePerMile = ratePerMile;
  }

  const dbLoad = {
    carrier_id: updated.carrierId,
    broker_name: updated.brokerName,
    broker_contact: updated.brokerContact,
    broker_phone: updated.brokerPhone,
    broker_email: updated.brokerEmail,
    broker_mc: updated.brokerMC,
    pickup_facility: updated.pickupFacility,
    pickup_address: updated.pickupAddress,
    pickup_city: updated.pickupCity,
    pickup_state: updated.pickupState,
    pickup_zip: updated.pickupZip,
    pickup_date: updated.pickupDate,
    pickup_time: updated.pickupTime,
    pickup_appt_number: updated.pickupApptNumber,
    delivery_facility: updated.deliveryFacility,
    delivery_address: updated.deliveryAddress,
    delivery_city: updated.deliveryCity,
    delivery_state: updated.deliveryState,
    delivery_zip: updated.deliveryZip,
    delivery_date: updated.deliveryDate,
    delivery_time: updated.deliveryTime,
    delivery_appt_number: updated.deliveryApptNumber,
    commodity: updated.commodity,
    weight: updated.weight,
    miles: updated.miles,
    rate: updated.rate,
    dispatch_fee_percent: updated.dispatchFeePercent,
    dispatch_fee_amount: updated.dispatchFeeAmount,
    carrier_net: updated.carrierNet,
    rate_per_mile: updated.ratePerMile,
    status: updated.status,
    notes: updated.notes,
    rat_con_url: updated.ratConUrl,
    bol_url: updated.bolUrl,
    pod_url: updated.podUrl,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedDb, error } = await supabase
    .from('loads')
    .update(dbLoad)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating load:', error);
    throw error;
  }
  return mapDbLoad(updatedDb);
}

export async function deleteLoad(id: string): Promise<void> {
  const { error } = await supabase
    .from('loads')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting load:', error);
    throw error;
  }
}

// ─── Load Check-ins ───────────────────────────────────────────────────────────

export async function getCheckins(loadId: string): Promise<SonexLoadCheckin[]> {
  const { data, error } = await supabase
    .from('load_checkins')
    .select('*')
    .eq('load_id', loadId)
    .order('timestamp', { ascending: true });
  if (error) {
    console.error('Error fetching check-ins:', error);
    return [];
  }
  return (data || []).map(c => ({
    id: c.id,
    loadId: c.load_id,
    event: c.event,
    timestamp: c.timestamp,
    notes: c.notes,
    loggedBy: c.logged_by,
  }));
}

export async function addCheckin(data: Omit<SonexLoadCheckin, 'id'>): Promise<SonexLoadCheckin> {
  const { data: inserted, error } = await supabase
    .from('load_checkins')
    .insert([{
      load_id: data.loadId,
      event: data.event,
      timestamp: data.timestamp || new Date().toISOString(),
      notes: data.notes,
      logged_by: data.loggedBy,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding check-in:', error);
    throw error;
  }
  return {
    id: inserted.id,
    loadId: inserted.load_id,
    event: inserted.event,
    timestamp: inserted.timestamp,
    notes: inserted.notes,
    loggedBy: inserted.logged_by,
  };
}

// ─── Cargo Photos ─────────────────────────────────────────────────────────────

export async function getCargoPhotos(loadId: string): Promise<SonexCargoPhoto[]> {
  const { data, error } = await supabase
    .from('cargo_photos')
    .select('*')
    .eq('load_id', loadId)
    .order('uploaded_at', { ascending: true });
  if (error) {
    console.error('Error fetching cargo photos:', error);
    return [];
  }
  return (data || []).map(p => ({
    id: p.id,
    loadId: p.load_id,
    url: p.url,
    stage: p.stage,
    caption: p.caption,
    uploadedAt: p.uploaded_at,
    uploadedBy: p.uploaded_by,
  }));
}

export async function addCargoPhoto(data: Omit<SonexCargoPhoto, 'id'>): Promise<SonexCargoPhoto> {
  const { data: inserted, error } = await supabase
    .from('cargo_photos')
    .insert([{
      load_id: data.loadId,
      url: data.url,
      stage: data.stage,
      caption: data.caption,
      uploaded_at: data.uploadedAt || new Date().toISOString(),
      uploaded_by: data.uploadedBy,
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding cargo photo:', error);
    throw error;
  }
  return {
    id: inserted.id,
    loadId: inserted.load_id,
    url: inserted.url,
    stage: inserted.stage,
    caption: inserted.caption,
    uploadedAt: inserted.uploaded_at,
    uploadedBy: inserted.uploaded_by,
  };
}

// ─── Carrier Documents ────────────────────────────────────────────────────────

export function computeDocStatus(expirationDate?: string): 'valid' | 'expiring_soon' | 'expired' | 'missing' {
  if (!expirationDate) return 'valid';
  const exp = new Date(expirationDate);
  const now = new Date();
  const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= 30) return 'expiring_soon';
  return 'valid';
}

export async function getDocuments(carrierId?: string): Promise<SonexDocument[]> {
  let query = supabase.from('carrier_documents').select('*');
  if (carrierId) query = query.eq('carrier_id', carrierId);
  const { data, error } = await query.order('uploaded_at', { ascending: false });
  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
  return (data || []).map(d => ({
    id: d.id,
    carrierId: d.carrier_id,
    docType: d.doc_type as DocType,
    fileName: d.file_name,
    fileUrl: d.file_url,
    filePath: d.file_path || '',
    expirationDate: d.expiration_date || undefined,
    uploadedAt: d.uploaded_at,
    uploadedBy: d.uploaded_by,
    notes: d.notes || undefined,
  }));
}

export async function addDocument(data: Omit<SonexDocument, 'id'>): Promise<SonexDocument> {
  // Upsert: replace existing doc of same type for same carrier
  const { data: inserted, error } = await supabase
    .from('carrier_documents')
    .upsert([{
      carrier_id: data.carrierId,
      doc_type: data.docType,
      file_name: data.fileName,
      file_url: data.fileUrl,
      file_path: data.filePath,
      expiration_date: data.expirationDate || null,
      uploaded_at: data.uploadedAt || new Date().toISOString(),
      uploaded_by: data.uploadedBy,
      notes: data.notes || null,
    }], { onConflict: 'carrier_id,doc_type' })
    .select()
    .single();
  if (error) {
    console.error('Error adding document:', error);
    throw error;
  }
  return {
    id: inserted.id,
    carrierId: inserted.carrier_id,
    docType: inserted.doc_type as DocType,
    fileName: inserted.file_name,
    fileUrl: inserted.file_url,
    filePath: inserted.file_path || '',
    expirationDate: inserted.expiration_date || undefined,
    uploadedAt: inserted.uploaded_at,
    uploadedBy: inserted.uploaded_by,
    notes: inserted.notes || undefined,
  };
}

export async function updateDocument(id: string, data: Partial<SonexDocument>): Promise<SonexDocument | null> {
  const dbData: any = {};
  if (data.fileName !== undefined) dbData.file_name = data.fileName;
  if (data.fileUrl !== undefined) dbData.file_url = data.fileUrl;
  if (data.filePath !== undefined) dbData.file_path = data.filePath;
  if (data.expirationDate !== undefined) dbData.expiration_date = data.expirationDate;
  if (data.notes !== undefined) dbData.notes = data.notes;
  dbData.uploaded_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('carrier_documents')
    .update(dbData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Error updating document:', error);
    return null;
  }
  return {
    id: updated.id,
    carrierId: updated.carrier_id,
    docType: updated.doc_type as DocType,
    fileName: updated.file_name,
    fileUrl: updated.file_url,
    filePath: updated.file_path || '',
    expirationDate: updated.expiration_date || undefined,
    uploadedAt: updated.uploaded_at,
    uploadedBy: updated.uploaded_by,
    notes: updated.notes || undefined,
  };
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('carrier_documents')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

export async function getExpiringDocuments(withinDays = 30): Promise<SonexDocument[]> {
  const docs = await getDocuments();
  const now = new Date();
  return docs.filter(d => {
    if (!d.expirationDate) return false;
    const exp = new Date(d.expirationDate);
    const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= withinDays; // includes already expired (negative days)
  }).sort((a, b) => {
    const da = new Date(a.expirationDate!).getTime();
    const db = new Date(b.expirationDate!).getTime();
    return da - db;
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(carrierId: string): Promise<SonexMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('carrier_id', carrierId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  return (data || []).map(m => ({
    id: m.id,
    carrierId: m.carrier_id,
    senderId: m.sender_id || '',
    senderName: m.sender_name,
    senderRole: m.sender_role,
    messageText: m.message_text,
    attachmentUrl: m.attachment_url || undefined,
    attachmentType: m.attachment_type || undefined,
    read: m.read,
    createdAt: m.created_at,
  }));
}

export async function getAllMessages(): Promise<SonexMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching all messages:', error);
    return [];
  }
  return (data || []).map(m => ({
    id: m.id,
    carrierId: m.carrier_id,
    senderId: m.sender_id || '',
    senderName: m.sender_name,
    senderRole: m.sender_role,
    messageText: m.message_text,
    attachmentUrl: m.attachment_url || undefined,
    attachmentType: m.attachment_type || undefined,
    read: m.read,
    createdAt: m.created_at,
  }));
}

export async function addMessage(data: Omit<SonexMessage, 'id'>): Promise<SonexMessage> {
  const { data: inserted, error } = await supabase
    .from('messages')
    .insert([{
      carrier_id: data.carrierId,
      sender_id: data.senderId || null,
      sender_name: data.senderName,
      sender_role: data.senderRole,
      message_text: data.messageText,
      attachment_url: data.attachmentUrl || null,
      attachment_type: data.attachmentType || null,
      read: data.read,
      created_at: data.createdAt || new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    throw error;
  }
  return {
    id: inserted.id,
    carrierId: inserted.carrier_id,
    senderId: inserted.sender_id || '',
    senderName: inserted.sender_name,
    senderRole: inserted.sender_role,
    messageText: inserted.message_text,
    attachmentUrl: inserted.attachment_url || undefined,
    attachmentType: inserted.attachment_type || undefined,
    read: inserted.read,
    createdAt: inserted.created_at,
  };
}

export async function markMessagesRead(carrierId: string, role: 'admin' | 'carrier'): Promise<void> {
  const senderRoleToMark = role === 'admin' ? 'carrier' : 'admin';
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('carrier_id', carrierId)
    .eq('sender_role', senderRoleToMark)
    .eq('read', false);

  if (error) {
    console.error('Error marking messages as read:', error);
  }
}

export async function getUnreadCountForCarrier(carrierId: string, viewerRole: 'admin' | 'carrier'): Promise<number> {
  const senderRoleToCount = viewerRole === 'admin' ? 'carrier' : 'admin';
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('carrier_id', carrierId)
    .eq('sender_role', senderRoleToCount)
    .eq('read', false);

  if (error) {
    console.error('Error counting unread messages:', error);
    return 0;
  }
  return count || 0;
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export async function getSettlements(carrierId?: string): Promise<SonexSettlement[]> {
  let query = supabase.from('settlements').select('*');
  if (carrierId) {
    query = query.eq('carrier_id', carrierId);
  }
  const { data, error } = await query.order('generated_at', { ascending: false });
  if (error) {
    console.error('Error fetching settlements:', error);
    return [];
  }
  return (data || []).map(s => ({
    id: s.id,
    carrierId: s.carrier_id,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    loadIds: s.load_ids,
    grossTotal: Number(s.gross_total),
    feeTotal: Number(s.fee_total),
    netTotal: Number(s.net_total),
    generatedAt: s.generated_at,
  }));
}

export async function addSettlement(data: Omit<SonexSettlement, 'id'>): Promise<SonexSettlement> {
  const { data: inserted, error } = await supabase
    .from('settlements')
    .insert([{
      carrier_id: data.carrierId,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      load_ids: data.loadIds,
      gross_total: data.grossTotal,
      fee_total: data.feeTotal,
      net_total: data.netTotal,
      generated_at: data.generatedAt || new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding settlement:', error);
    throw error;
  }
  return {
    id: inserted.id,
    carrierId: inserted.carrier_id,
    periodStart: inserted.period_start,
    periodEnd: inserted.period_end,
    loadIds: inserted.load_ids,
    grossTotal: Number(inserted.gross_total),
    feeTotal: Number(inserted.fee_total),
    netTotal: Number(inserted.net_total),
    generatedAt: inserted.generated_at,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SonexSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) {
    console.error('Error fetching settings:', error);
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
  return {
    companyName: data.company_name,
    companyAddress: data.company_address || '',
    companyCity: data.company_city || '',
    companyState: data.company_state || '',
    companyZip: data.company_zip || '',
    companyEmail: data.company_email || '',
    companyPhone: data.company_phone || '',
    defaultDispatchFeePercent: Number(data.default_dispatch_fee_percent),
    adminUsers: data.admin_users || [],
  };
}

export async function updateSettings(data: Partial<SonexSettings>): Promise<SonexSettings> {
  const current = await getSettings();
  const updated = { ...current, ...data };

  const dbSettings = {
    company_name: updated.companyName,
    company_address: updated.companyAddress,
    company_city: updated.companyCity,
    company_state: updated.companyState,
    company_zip: updated.companyZip,
    company_email: updated.companyEmail,
    company_phone: updated.companyPhone,
    default_dispatch_fee_percent: updated.defaultDispatchFeePercent,
    admin_users: updated.adminUsers,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedDb, error } = await supabase
    .from('settings')
    .update(dbSettings)
    .eq('id', 1)
    .select()
    .single();

  if (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
  return {
    companyName: updatedDb.company_name,
    companyAddress: updatedDb.company_address || '',
    companyCity: updatedDb.company_city || '',
    companyState: updatedDb.company_state || '',
    companyZip: updatedDb.company_zip || '',
    companyEmail: updatedDb.company_email || '',
    companyPhone: updatedDb.company_phone || '',
    defaultDispatchFeePercent: Number(updatedDb.default_dispatch_fee_percent),
    adminUsers: updatedDb.admin_users || [],
  };
}

// ─── Analytics Helpers ────────────────────────────────────────────────────────

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
  const loads = await getLoadsByCarrier(carrierId);
  const completed = loads.filter(l => ['delivered', 'pod_received', 'invoiced', 'paid'].includes(l.status));
  const active = loads.filter(l => ['booked', 'dispatched', 'in_transit'].includes(l.status));
  const lifetimeGross = completed.reduce((s, l) => s + l.rate, 0);
  const lifetimeFees = completed.reduce((s, l) => s + l.dispatchFeeAmount, 0);
  const lifetimeNet = lifetimeGross - lifetimeFees;
  const avgRPM = completed.length > 0
    ? completed.reduce((s, l) => s + l.ratePerMile, 0) / completed.length
    : 0;
  return {
    totalLoads: loads.length,
    completedLoads: completed.length,
    activeLoads: active.length,
    lifetimeGross,
    lifetimeFees,
    lifetimeNet,
    avgRPM: Math.round(avgRPM * 100) / 100,
  };
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
  const carriers = await getCarriers();
  const loads = await getLoads();
  const now = new Date();

  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const completedThisWeek = loads.filter(l => {
    const done = ['delivered', 'pod_received', 'invoiced', 'paid'].includes(l.status);
    const updatedAt = new Date(l.updatedAt);
    return done && updatedAt >= weekStart;
  });

  const completedThisMonth = loads.filter(l => {
    const done = ['delivered', 'pod_received', 'invoiced', 'paid'].includes(l.status);
    const updatedAt = new Date(l.updatedAt);
    return done && updatedAt >= monthStart;
  });

  const grossThisMonth = completedThisMonth.reduce((s, l) => s + l.rate, 0);
  const feesThisMonth = completedThisMonth.reduce((s, l) => s + l.dispatchFeeAmount, 0);
  const avgRPM = completedThisMonth.length > 0
    ? completedThisMonth.reduce((s, l) => s + l.ratePerMile, 0) / completedThisMonth.length
    : 0;

  return {
    activeCarriers: carriers.filter(c => c.status === 'active').length,
    loadsInProgress: loads.filter(l => ['booked', 'dispatched', 'in_transit'].includes(l.status)).length,
    loadsCompletedThisWeek: completedThisWeek.length,
    grossThisMonth: Math.round(grossThisMonth * 100) / 100,
    feesThisMonth: Math.round(feesThisMonth * 100) / 100,
    avgRPMThisMonth: Math.round(avgRPM * 100) / 100,
  };
}

export async function getTodayActivity(): Promise<{ pickups: SonexLoad[]; deliveries: SonexLoad[] }> {
  const loads = await getLoads();
  const today = new Date().toISOString().split('T')[0];
  return {
    pickups: loads.filter(l => l.pickupDate === today && ['booked', 'dispatched', 'in_transit'].includes(l.status)),
    deliveries: loads.filter(l => l.deliveryDate === today && ['in_transit'].includes(l.status)),
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function exportLoadsCSV(loads: SonexLoad[], carriers: SonexCarrier[]): string {
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
