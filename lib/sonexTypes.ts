// â”€â”€â”€ Sonex Dispatch Hub â€” Type Definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€â”€ Enums â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CarrierStatus = 'active' | 'inactive' | 'onboarding';

export type InsuranceType = 'vin_scheduled' | 'certificate_holder' | 'additional_insured';

export type EquipmentType =
  | 'flatbed'
  | 'step_deck'
  | 'lowboy'
  | 'dry_van'
  | 'reefer'
  | 'box_truck'
  | 'hotshot'
  | 'tanker'
  | 'car_hauler'
  | 'conestoga'
  | 'curtain_side';

export type LoadStatus =
  | 'booked'
  | 'dispatched'
  | 'in_transit'
  | 'delivered'
  | 'pod_received'
  | 'invoiced'
  | 'paid';

export type CheckinEvent =
  | 'arrived_pickup'
  | 'loaded_departing'
  | 'arrived_delivery'
  | 'delivered'
  | 'detention_start'
  | 'detention_end'
  | 'layover_start'
  | 'layover_end'
  | 'tonu'
  | 'breakdown'
  | 'accident';

export type SonexRole = 'admin' | 'mc_owner' | 'carrier';

// â”€â”€â”€ Core Entities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SonexCarrier {
  id: string;
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  // Equipment
  equipmentType: EquipmentType;
  truckYear: number;
  truckMake: string;
  truckModel: string;
  truckVin: string;
  truckPlate: string;
  truckState: string;
  weightCapacity: number; // lbs
  // Trailer
  hasTrailer: boolean;
  trailerType?: string;
  trailerVin?: string;
  trailerPlate?: string;
  trailerState?: string;
  trailerLength?: number; // feet
  // Authority
  hasOwnAuthority: boolean;
  mcNumber?: string;
  dotNumber?: string;
  isLeasedMC: boolean;
  mcHolderName?: string;
  mcHolderMC?: string;
  // Insurance
  insuranceType: InsuranceType;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  // Business
  mcOwnerId?: string;
  totalFeePercent: number; // full carrier deduction; the MC owner receives the remainder after Sonex's dispatch fee
  dispatchFeePercent: number; // e.g. 10 = 10%
  status: CarrierStatus;
  notes: string;
  // Portal login
  portalEmail: string;
  // Meta
  joinedAt: string;   // ISO 8601
  updatedAt: string;
}

export interface SonexLoad {
  id: string;
  loadNumber: string;    // e.g. SNX-2025-001
  carrierId: string;
  mcOwnerId?: string;
  driverId?: string;
  equipmentId?: string;
  // Broker
  brokerName: string;
  brokerContact: string;
  brokerPhone: string;
  brokerEmail?: string;
  brokerMC?: string;
  // Pickup
  pickupFacility: string;
  pickupAddress: string;
  pickupCity: string;
  pickupState: string;
  pickupZip: string;
  pickupDate: string;    // ISO 8601
  pickupTime: string;    // HH:MM
  pickupApptNumber?: string;
  // Delivery
  deliveryFacility: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryZip: string;
  deliveryDate: string;  // ISO 8601
  deliveryTime: string;  // HH:MM
  deliveryApptNumber?: string;
  // Cargo
  commodity: string;
  weight: number;        // lbs
  miles: number;
  // Financials
  rate: number;                  // gross from broker (USD)
  totalFeePercent: number;
  totalFeeAmount: number;
  dispatchFeePercent: number;    // e.g. 10
  dispatchFeeAmount: number;     // auto-calculated
  mcOwnerFeeAmount: number;
  carrierNet: number;            // auto-calculated
  ratePerMile: number;           // auto-calculated
  // Status
  status: LoadStatus;
  // Document URLs (base64 for mock)
  ratConUrl?: string;
  bolUrl?: string;
  podUrl?: string;
  // Notes
  notes: string;
  freeTimeMinutes: number;
  detentionHours: number;
  detentionRate: number;
  detentionRevenue: number;
  // Meta
  createdAt: string;
  updatedAt: string;
}

export interface SonexLoadCheckin {
  id: string;
  loadId: string;
  event: CheckinEvent;
  timestamp: string;  // ISO 8601
  notes: string;
  loggedBy: SonexRole;
}

export interface SonexCargoPhoto {
  id: string;
  loadId: string;
  url: string;        // base64 data URL for mock
  stage: 'pickup' | 'delivery';
  caption: string;
  uploadedAt: string;
  uploadedBy: SonexRole;
}

export interface SonexSettlement {
  id: string;
  carrierId: string;
  periodStart: string;   // ISO date
  periodEnd: string;     // ISO date
  loadIds: string[];
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
  generatedAt: string;
}

// â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SonexUser {
  id: string;
  email: string;
  role: SonexRole;
  displayName: string;
  carrierId?: string;    // set for carrier role
  mcOwnerId?: string;    // set for mc_owner role
  avatar: string;        // 2-letter initials
  adminPreview?: boolean; // admin-authorized portal switch session
}

export interface SonexMcOwner {
  id: string;
  ownerName: string;
  companyName: string;
  email: string;
  phone: string;
  mcNumber: string;
  dotNumber?: string;
  canManageLeasedCarriers: boolean;
  primaryCarrierId?: string;
  defaultTotalFeePercent: number;
  defaultDispatchFeePercent: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// â”€â”€â”€ Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SonexAdminUser {
  id: string;
  name: string;
  email: string;
}

export interface SonexSettings {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZip: string;
  companyEmail: string;
  companyPhone: string;
  defaultDispatchFeePercent: number;
  adminUsers: SonexAdminUser[];
}

// â”€â”€â”€ Full Store Snapshot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface SonexStoreData {
  carriers: SonexCarrier[];
  loads: SonexLoad[];
  checkins: SonexLoadCheckin[];
  cargoPhotos: SonexCargoPhoto[];
  settlements: SonexSettlement[];
  settings: SonexSettings;
  initialized: boolean;
}

// â”€â”€â”€ UI Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  booked: 'Booked',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  pod_received: 'POD Received',
  invoiced: 'Invoiced',
  paid: 'Paid',
};

export const LOAD_STATUS_ORDER: LoadStatus[] = [
  'booked', 'dispatched', 'in_transit', 'delivered', 'pod_received', 'invoiced', 'paid',
];

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  flatbed: 'Flatbed',
  step_deck: 'Step Deck',
  lowboy: 'Lowboy',
  dry_van: 'Dry Van',
  reefer: 'Reefer',
  box_truck: 'Box Truck',
  hotshot: 'Hotshot',
  tanker: 'Tanker',
  car_hauler: 'Car Hauler',
  conestoga: 'Conestoga',
  curtain_side: 'Curtain Side',
};

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  vin_scheduled: 'VIN Scheduled',
  certificate_holder: 'Certificate Holder Only',
  additional_insured: 'Additional Insured',
};

export const CHECKIN_EVENT_LABELS: Record<CheckinEvent, string> = {
  arrived_pickup:   'Arrived at Pickup',
  loaded_departing: 'Loaded - Departing',
  arrived_delivery: 'Arrived at Delivery',
  delivered:        'Delivered',
  detention_start:  'Detention Started',
  detention_end:    'Detention Ended',
  layover_start:    'Layover Started',
  layover_end:      'Layover Ended',
  tonu:             'TONU (Truck Ordered Not Used)',
  breakdown:        'Breakdown Reported',
  accident:         'Accident Reported',
};

export function computeLoadFinancials(rate: number, miles: number, totalFeePercent: number, dispatchFeePercent: number) {
  const boundedTotalFeePercent = Math.max(0, Math.min(100, totalFeePercent));
  const boundedDispatchFeePercent = Math.max(0, Math.min(boundedTotalFeePercent, dispatchFeePercent));
  const totalFeeAmount = Math.round(rate * (boundedTotalFeePercent / 100) * 100) / 100;
  const dispatchFeeAmount = Math.round(rate * (boundedDispatchFeePercent / 100) * 100) / 100;
  const mcOwnerFeeAmount = Math.round((totalFeeAmount - dispatchFeeAmount) * 100) / 100;
  const carrierNet = Math.round((rate - totalFeeAmount) * 100) / 100;
  const ratePerMile = miles > 0 ? Math.round((rate / miles) * 100) / 100 : 0;
  return { totalFeeAmount, dispatchFeeAmount, mcOwnerFeeAmount, carrierNet, ratePerMile };
}


