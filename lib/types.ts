// ─── Load & Transport ───────────────────────────────────────────────────────

export type LoadStatus =
  | 'available'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'invoiced'
  | 'paid';

export type USTimezone = 'EST' | 'CST' | 'MST' | 'PST';

export interface Facility {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  timezone: USTimezone;
}

export interface LoadAppointment {
  facility: Facility;
  scheduledTime: string; // ISO 8601
  appointmentNumber?: string;
}

export interface Load {
  id: string;
  referenceNumber: string;
  broker: string;
  brokerId: string;
  commodity: string;
  weight: number; // lbs
  miles: number;
  rate: number; // USD
  ratePerMile: number;
  status: LoadStatus;
  driverId: string | null;
  dispatcherId: string;
  pickup: LoadAppointment;
  delivery: LoadAppointment;
  trackingLink?: string;
  rcUrl?: string;
  bolUrl?: string;
  podUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Driver & ELD ────────────────────────────────────────────────────────────

export type DriverStatus = 'available' | 'on_duty' | 'driving' | 'off_duty' | 'sleeper';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  cdlNumber: string;
  truckId: string;
  truckNumber: string;
  status: DriverStatus;
  currentLocation: {
    lat: number;
    lng: number;
    city: string;
    state: string;
  };
  avatar?: string;
}

export interface HOSData {
  driverId: string;
  hoursRemaining: number;        // hours left before mandatory rest
  driveTimeRemaining: number;    // 11-hr rule remaining
  onDutyTimeRemaining: number;   // 14-hr rule remaining
  cycleHoursUsed: number;        // 70-hr/8-day cycle
  cycleHoursRemaining: number;
  nextResetAt: string;           // ISO 8601
  currentDutyStatus: DriverStatus;
  violations: string[];
}

// ─── Financial ───────────────────────────────────────────────────────────────

export interface TruckFinancial {
  truckId: string;
  truckNumber: string;
  driverName: string;
  grossRevenue: number;
  fuelCost: number;
  maintenanceCost: number;
  factoringFee: number;
  netProfit: number;
  netMarginPct: number;
  loadsCompleted: number;
  milesRun: number;
}

export interface WeeklyFinancial {
  weekLabel: string;          // e.g. "Apr 7"
  grossRevenue: number;
  fuelCost: number;
  maintenanceCost: number;
  netProfit: number;
}

export interface FinancialSummary {
  perTruck: TruckFinancial[];
  weekly: WeeklyFinancial[];
  totals: {
    grossRevenue: number;
    fuelCost: number;
    maintenanceCost: number;
    netProfit: number;
    activeLoads: number;
    loadsThisMonth: number;
  };
}

// ─── Rate Prediction ─────────────────────────────────────────────────────────

export interface RatePredictionRequest {
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  miles: number;
  commodity: string;
  weight: number;
}

export interface RatePredictionResponse {
  suggestedRate: number;
  ratePerMile: number;
  confidence: number;       // 0–100
  historicalAvg: number;
  laneScore: 'hot' | 'warm' | 'soft';
  demandIndex: number;      // 0–10
  seasonalAdjustment: number; // percentage modifier
  comparisons: { source: string; rate: number }[];
}

// ─── Factoring ────────────────────────────────────────────────────────────────

export interface FactoringSubmission {
  loadId: string;
  submissionId: string;
  factoringCompany: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'funded' | 'rejected';
  advanceRate: number;       // percentage
  advanceAmount: number;     // USD
  expectedFundingDate: string;
  documents: {
    rc: boolean;
    bol: boolean;
    pod: boolean;
  };
}

// ─── Dispatcher Performance ───────────────────────────────────────────────────

export interface DispatcherPerformance {
  id: string;
  name: string;
  avatar?: string;
  loadsThisWeek: number;
  loadsThisMonth: number;
  grossRevenueGenerated: number;
  baseSalary: number;          // weekly
  performanceBonus: number;    // calculated
  totalCompensation: number;
  netROI: number;              // grossRevenue - totalCompensation
  avgRatePerMile: number;
  avgLoadValue: number;
  rank: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageSender = 'dispatcher' | 'driver' | 'system' | 'ai';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  senderName: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  loadId: string;
  loadReference: string;
  dispatcherId: string;
  dispatcherName: string;
  driverId: string;
  driverName: string;
  messages: ChatMessage[];
  aiSummary: string;
  lastActivity: string;
  unreadCount: number;
}

// ─── Parsed RC (OCR Result) ───────────────────────────────────────────────────

export interface ParsedRC {
  broker: string;
  brokerMC: string;
  loadReference: string;
  commodity: string;
  weight: string;
  rate: number;
  miles: number;
  pickup: {
    facilityName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    appointmentTime: string;
    timezone: USTimezone;
  };
  delivery: {
    facilityName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    appointmentTime: string;
    timezone: USTimezone;
  };
  specialInstructions?: string;
  confidence: number; // OCR confidence 0-100
}
