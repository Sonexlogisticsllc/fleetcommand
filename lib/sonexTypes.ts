// ─── Sonex Dispatch Hub — Type Definitions ───────────────────────────────────

// ─── Enums ───────────────────────────────────────────────────────────────────

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

export type SonexRole = 'admin' | 'carrier';

export type DocType =
  | 'drivers_license_front'
  | 'drivers_license_back'
  | 'cdl_front'
  | 'cdl_back'
  | 'medical_card'
  | 'mvr'
  | 'truck_registration'
  | 'trailer_registration'
  | 'dot_inspection'
  | 'coi'          // Certificate of Insurance
  | 'w9'
  | 'dispatch_agreement'
  | 'mc_lease'
  | 'drug_test'
  | 'background_check'
  | 'void_check'
  | 'eld_certificate';

export type DocStatus = 'valid' | 'expiring_soon' | 'expired' | 'missing';

export const DOCS_WITH_EXPIRY: DocType[] = [
  'drivers_license_front', 'drivers_license_back',
  'cdl_front', 'cdl_back',
  'medical_card', 'mvr',
  'truck_registration', 'trailer_registration',
  'dot_inspection', 'coi', 'drug_test',
];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  drivers_license_front: "Driver's License (Front)",
  drivers_license_back:  "Driver's License (Back)",
  cdl_front:             'CDL (Front)',
  cdl_back:              'CDL (Back)',
  medical_card:          'Medical Card',
  mvr:                   'Motor Vehicle Record',
  truck_registration:    'Truck Registration',
  trailer_registration:  'Trailer Registration',
  dot_inspection:        'DOT Inspection',
  coi:                   'Certificate of Insurance',
  w9:                    'W-9 Form',
  dispatch_agreement:    'Dispatch Agreement',
  mc_lease:              'MC Lease Agreement',
  drug_test:             'Drug Test',
  background_check:      'Background Check',
  void_check:            'Voided Check (Direct Deposit)',
  eld_certificate:       'ELD Certificate',
};

export const ALL_DOC_TYPES: DocType[] = [
  'drivers_license_front', 'drivers_license_back',
  'cdl_front', 'cdl_back',
  'medical_card', 'mvr',
  'truck_registration', 'trailer_registration',
  'dot_inspection', 'coi', 'w9',
  'dispatch_agreement', 'mc_lease',
  'drug_test', 'background_check',
  'void_check', 'eld_certificate',
];

export interface SonexDocument {
  id: string;
  carrierId: string;
  docType: DocType;
  fileName: string;
  fileUrl: string;       // Supabase Storage public URL
  filePath: string;      // Storage path for deletion
  expirationDate?: string;  // ISO date, for docs that expire
  uploadedAt: string;
  uploadedBy: 'admin' | 'carrier';
  notes?: string;
}

// ─── Core Entities ────────────────────────────────────────────────────────────

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
  dispatchFeePercent: number;    // e.g. 10
  dispatchFeeAmount: number;     // auto-calculated
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
  loggedBy: 'admin' | 'carrier';
}

export interface SonexCargoPhoto {
  id: string;
  loadId: string;
  url: string;        // base64 data URL for mock
  stage: 'pickup' | 'delivery';
  caption: string;
  uploadedAt: string;
  uploadedBy: 'admin' | 'carrier';
}

export interface SonexMessage {
  id: string;
  carrierId: string;        // the conversation thread is per-carrier
  senderId: string;         // 'admin' or carrier id
  senderName: string;
  senderRole: 'admin' | 'carrier';
  messageText: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'document';
  read: boolean;
  createdAt: string;
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SonexUser {
  id: string;
  email: string;
  role: SonexRole;
  displayName: string;
  carrierId?: string;    // set for carrier role
  avatar: string;        // 2-letter initials
}

// ─── Settings ─────────────────────────────────────────────────────────────────

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

// ─── Full Store Snapshot ──────────────────────────────────────────────────────

export interface SonexStoreData {
  carriers: SonexCarrier[];
  loads: SonexLoad[];
  checkins: SonexLoadCheckin[];
  cargoPhotos: SonexCargoPhoto[];
  documents: SonexDocument[];
  messages: SonexMessage[];
  settlements: SonexSettlement[];
  settings: SonexSettings;
  initialized: boolean;
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

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
  loaded_departing: 'Loaded — Departing',
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
