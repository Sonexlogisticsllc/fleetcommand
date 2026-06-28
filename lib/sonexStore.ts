// ─── Sonex Dispatch Hub — localStorage Store ──────────────────────────────────
'use client';

import type {
  SonexCarrier, SonexLoad, SonexLoadCheckin, SonexCargoPhoto,
  SonexMessage, SonexSettlement, SonexStoreData,
  SonexSettings,
} from './sonexTypes';
import {
  DEFAULT_SETTINGS, MOCK_CARRIERS, MOCK_LOADS, MOCK_CHECKINS,
  MOCK_MESSAGES, MOCK_SETTLEMENTS,
} from './sonexData';

const STORE_KEY = 'sonex_dispatch_hub_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function computeLoadFinancials(rate: number, miles: number, feePercent: number) {
  const dispatchFeeAmount = Math.round(rate * (feePercent / 100) * 100) / 100;
  const carrierNet = Math.round((rate - dispatchFeeAmount) * 100) / 100;
  const ratePerMile = miles > 0 ? Math.round((rate / miles) * 100) / 100 : 0;
  return { dispatchFeeAmount, carrierNet, ratePerMile };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateLoadNumber(existingLoads: SonexLoad[]): string {
  const year = new Date().getFullYear();
  const existing = existingLoads
    .map(l => parseInt(l.loadNumber.split('-').pop() || '0'))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `SNX-${year}-${String(next).padStart(3, '0')}`;
}

// ─── Store Init ───────────────────────────────────────────────────────────────

function getDefaultStore(): SonexStoreData {
  return {
    carriers: MOCK_CARRIERS,
    loads: MOCK_LOADS,
    checkins: MOCK_CHECKINS,
    cargoPhotos: [],
    messages: MOCK_MESSAGES,
    settlements: MOCK_SETTLEMENTS,
    settings: DEFAULT_SETTINGS,
    initialized: true,
  };
}

function readStore(): SonexStoreData {
  if (typeof window === 'undefined') return getDefaultStore();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      const defaults = getDefaultStore();
      localStorage.setItem(STORE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(raw) as SonexStoreData;
  } catch {
    return getDefaultStore();
  }
}

function writeStore(data: SonexStoreData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resetStore(): void {
  writeStore(getDefaultStore());
}

// ─── Carriers ─────────────────────────────────────────────────────────────────

export function getCarriers(): SonexCarrier[] {
  return readStore().carriers;
}

export function getCarrier(id: string): SonexCarrier | undefined {
  return readStore().carriers.find(c => c.id === id);
}

export function addCarrier(data: Omit<SonexCarrier, 'id' | 'joinedAt' | 'updatedAt'>): SonexCarrier {
  const store = readStore();
  const now = new Date().toISOString();
  const carrier: SonexCarrier = {
    ...data,
    id: generateId('carrier'),
    joinedAt: now,
    updatedAt: now,
  };
  store.carriers.push(carrier);
  writeStore(store);
  return carrier;
}

export function updateCarrier(id: string, data: Partial<SonexCarrier>): SonexCarrier | null {
  const store = readStore();
  const idx = store.carriers.findIndex(c => c.id === id);
  if (idx === -1) return null;
  store.carriers[idx] = { ...store.carriers[idx], ...data, updatedAt: new Date().toISOString() };
  writeStore(store);
  return store.carriers[idx];
}

export function deleteCarrier(id: string): void {
  const store = readStore();
  store.carriers = store.carriers.filter(c => c.id !== id);
  writeStore(store);
}

// ─── Loads ────────────────────────────────────────────────────────────────────

export function getLoads(): SonexLoad[] {
  return readStore().loads;
}

export function getLoad(id: string): SonexLoad | undefined {
  return readStore().loads.find(l => l.id === id);
}

export function getLoadsByCarrier(carrierId: string): SonexLoad[] {
  return readStore().loads.filter(l => l.carrierId === carrierId);
}

export function addLoad(data: Omit<SonexLoad, 'id' | 'loadNumber' | 'dispatchFeeAmount' | 'carrierNet' | 'ratePerMile' | 'createdAt' | 'updatedAt'>): SonexLoad {
  const store = readStore();
  const now = new Date().toISOString();
  const { dispatchFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(data.rate, data.miles, data.dispatchFeePercent);
  const load: SonexLoad = {
    ...data,
    id: generateId('load'),
    loadNumber: generateLoadNumber(store.loads),
    dispatchFeeAmount,
    carrierNet,
    ratePerMile,
    createdAt: now,
    updatedAt: now,
  };
  store.loads.push(load);
  writeStore(store);
  return load;
}

export function updateLoad(id: string, data: Partial<SonexLoad>): SonexLoad | null {
  const store = readStore();
  const idx = store.loads.findIndex(l => l.id === id);
  if (idx === -1) return null;
  const updated = { ...store.loads[idx], ...data, updatedAt: new Date().toISOString() };
  // Recompute financials if relevant fields changed
  if (data.rate !== undefined || data.miles !== undefined || data.dispatchFeePercent !== undefined) {
    const { dispatchFeeAmount, carrierNet, ratePerMile } = computeLoadFinancials(
      updated.rate, updated.miles, updated.dispatchFeePercent
    );
    updated.dispatchFeeAmount = dispatchFeeAmount;
    updated.carrierNet = carrierNet;
    updated.ratePerMile = ratePerMile;
  }
  store.loads[idx] = updated;
  writeStore(store);
  return store.loads[idx];
}

export function deleteLoad(id: string): void {
  const store = readStore();
  store.loads = store.loads.filter(l => l.id !== id);
  writeStore(store);
}

// ─── Load Check-ins ───────────────────────────────────────────────────────────

export function getCheckins(loadId: string): SonexLoadCheckin[] {
  return readStore().checkins.filter(c => c.loadId === loadId).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export function addCheckin(data: Omit<SonexLoadCheckin, 'id'>): SonexLoadCheckin {
  const store = readStore();
  const checkin: SonexLoadCheckin = { ...data, id: generateId('ci') };
  store.checkins.push(checkin);
  writeStore(store);
  return checkin;
}

// ─── Cargo Photos ─────────────────────────────────────────────────────────────

export function getCargoPhotos(loadId: string): SonexCargoPhoto[] {
  return readStore().cargoPhotos.filter(p => p.loadId === loadId);
}

export function addCargoPhoto(data: Omit<SonexCargoPhoto, 'id'>): SonexCargoPhoto {
  const store = readStore();
  const photo: SonexCargoPhoto = { ...data, id: generateId('photo') };
  store.cargoPhotos.push(photo);
  writeStore(store);
  return photo;
}

// Messages ─────────────────────────────────────────────────────────────────

export function getMessages(carrierId: string): SonexMessage[] {
  return readStore().messages
    .filter(m => m.carrierId === carrierId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getAllMessages(): SonexMessage[] {
  return readStore().messages;
}

export function addMessage(data: Omit<SonexMessage, 'id'>): SonexMessage {
  const store = readStore();
  const message: SonexMessage = { ...data, id: generateId('msg') };
  store.messages.push(message);
  writeStore(store);
  return message;
}

export function markMessagesRead(carrierId: string, role: 'admin' | 'carrier'): void {
  const store = readStore();
  // Mark unread messages sent TO this role as read
  store.messages = store.messages.map(m => {
    if (m.carrierId === carrierId && !m.read) {
      // Admin reads: mark carrier messages as read
      // Carrier reads: mark admin messages as read
      if (role === 'admin' && m.senderRole === 'carrier') return { ...m, read: true };
      if (role === 'carrier' && m.senderRole === 'admin') return { ...m, read: true };
    }
    return m;
  });
  writeStore(store);
}

export function getUnreadCountForCarrier(carrierId: string, viewerRole: 'admin' | 'carrier'): number {
  const messages = readStore().messages.filter(m => m.carrierId === carrierId && !m.read);
  return messages.filter(m => {
    if (viewerRole === 'admin') return m.senderRole === 'carrier';
    return m.senderRole === 'admin';
  }).length;
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export function getSettlements(carrierId?: string): SonexSettlement[] {
  const store = readStore();
  return carrierId ? store.settlements.filter(s => s.carrierId === carrierId) : store.settlements;
}

export function addSettlement(data: Omit<SonexSettlement, 'id'>): SonexSettlement {
  const store = readStore();
  const settlement: SonexSettlement = { ...data, id: generateId('settle') };
  store.settlements.push(settlement);
  writeStore(store);
  return settlement;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSettings(): SonexSettings {
  return readStore().settings;
}

export function updateSettings(data: Partial<SonexSettings>): SonexSettings {
  const store = readStore();
  store.settings = { ...store.settings, ...data };
  writeStore(store);
  return store.settings;
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

export function getCarrierStats(carrierId: string): CarrierStats {
  const loads = getLoadsByCarrier(carrierId);
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

export function getDashboardStats(): DashboardStats {
  const carriers = getCarriers();
  const loads = getLoads();
  const now = new Date();

  // Week boundaries (Mon-Sun)
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);

  // Month boundaries
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

export function getTodayActivity(): { pickups: SonexLoad[]; deliveries: SonexLoad[] } {
  const loads = getLoads();
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
