// ─── Sales Mock Data ──────────────────────────────────────────────────────────

export type LeadStatus = 'new' | 'contacted' | 'demo' | 'negotiating' | 'signed' | 'lost';
export type EquipmentType = 'Dry Van' | 'Reefer' | 'Flatbed' | 'Step Deck' | 'Tanker' | 'Box Truck';

export interface TruckerLead {
  id: string;
  name: string;
  company: string;
  phone: string;
  dotNumber: string;
  equipment: EquipmentType;
  trucks: number;
  homeState: string;
  preferredLanes: string[];
  status: LeadStatus;
  assignedTo: string;
  lastContact: string | null;
  nextFollowUp: string | null;
  notes: string;
  monthlyRevenuePotential: number;
  source: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  leadId: string;
  leadName: string;
  company: string;
  phone: string;
  type: 'ai_outbound' | 'manual_outbound' | 'inbound';
  status: 'completed' | 'no_answer' | 'voicemail' | 'callback' | 'busy';
  duration: number; // seconds
  timestamp: string;
  agentName: string;
  outcome: string;
  summary: string;
  transcript?: CallMessage[];
  recordingUrl?: string;
}

export interface CallMessage {
  speaker: 'ai' | 'trucker';
  text: string;
  timestamp: number; // seconds from call start
}

export interface SalesDashboardStats {
  callsToday: number;
  callsThisWeek: number;
  leadsThisMonth: number;
  signedThisMonth: number;
  conversionRate: number;
  revenueGenerated: number;
  pipelineValue: number;
}

// ─── LEADS ────────────────────────────────────────────────────────────────────

export const MOCK_LEADS: TruckerLead[] = [
  {
    id: 'lead-001', name: 'Robert "Bobby" Castillo', company: 'Castillo Trucking LLC',
    phone: '(512) 555-0187', dotNumber: 'DOT-3812991', equipment: 'Dry Van',
    trucks: 3, homeState: 'TX', preferredLanes: ['TX-IL', 'TX-CA', 'TX-FL'],
    status: 'new', assignedTo: 'AI Caller', lastContact: null, nextFollowUp: '2026-04-22T14:00:00Z',
    notes: 'Found on FMCSA portal. 3 trucks, mostly SE lanes. High revenue potential.',
    monthlyRevenuePotential: 42000, source: 'FMCSA Lookup', createdAt: '2026-04-22T10:00:00Z',
  },
  {
    id: 'lead-002', name: 'Diana Nguyen', company: 'Nguyen Transport Inc.',
    phone: '(214) 555-0334', dotNumber: 'DOT-4421007', equipment: 'Reefer',
    trucks: 1, homeState: 'TX', preferredLanes: ['TX-CO', 'TX-NM'],
    status: 'contacted', assignedTo: 'Sales Team', lastContact: '2026-04-21T16:00:00Z',
    nextFollowUp: '2026-04-23T10:00:00Z',
    notes: 'Spoke for 8 min. Interested in reefer loads out of Dallas. Send sample load list.',
    monthlyRevenuePotential: 18000, source: 'Referral', createdAt: '2026-04-20T09:00:00Z',
  },
  {
    id: 'lead-003', name: 'Marcus "Big Mac" Freeman', company: 'Freeman Logistics LLC',
    phone: '(404) 555-0219', dotNumber: 'DOT-5511233', equipment: 'Flatbed',
    trucks: 5, homeState: 'GA', preferredLanes: ['SE Region', 'GA-TX', 'GA-OH'],
    status: 'demo', assignedTo: 'Sales Team', lastContact: '2026-04-21T11:00:00Z',
    nextFollowUp: '2026-04-22T15:00:00Z',
    notes: 'Demoed FleetCommand dashboard. Very impressed with RC parser. Wants 2-week trial.',
    monthlyRevenuePotential: 67000, source: 'LinkedIn', createdAt: '2026-04-15T08:00:00Z',
  },
  {
    id: 'lead-004', name: 'Yolanda Kim', company: 'Kim Express Corp',
    phone: '(773) 555-0445', dotNumber: 'DOT-6644512', equipment: 'Dry Van',
    trucks: 8, homeState: 'IL', preferredLanes: ['Midwest', 'IL-TX', 'IL-CA'],
    status: 'negotiating', assignedTo: 'Sales Team', lastContact: '2026-04-21T13:30:00Z',
    nextFollowUp: '2026-04-22T09:00:00Z',
    notes: 'Ready to sign. Negotiating on dispatch fee (wants 8% instead of 10%). Has 8 trucks!',
    monthlyRevenuePotential: 115000, source: 'Cold Call', createdAt: '2026-04-10T14:00:00Z',
  },
  {
    id: 'lead-005', name: 'Tony Okafor', company: 'Okafor Fleet Services',
    phone: '(469) 555-0678', dotNumber: 'DOT-7733981', equipment: 'Step Deck',
    trucks: 2, homeState: 'TX', preferredLanes: ['TX-OK', 'TX-NM', 'Southwest'],
    status: 'signed', assignedTo: 'Sales Team', lastContact: '2026-04-20T10:00:00Z',
    nextFollowUp: null,
    notes: 'SIGNED! 2 step decks. Monthly flat fee $1800. Onboarding scheduled Apr 24.',
    monthlyRevenuePotential: 28000, source: 'Referral', createdAt: '2026-04-05T11:00:00Z',
  },
  {
    id: 'lead-006', name: 'Sandra Morales', company: 'Morales Family Trucking',
    phone: '(915) 555-0512', dotNumber: 'DOT-8821004', equipment: 'Dry Van',
    trucks: 1, homeState: 'TX', preferredLanes: ['TX-CA', 'West Coast'],
    status: 'new', assignedTo: 'AI Caller', lastContact: null, nextFollowUp: '2026-04-22T10:00:00Z',
    notes: 'Owner-operator, 1 truck. Runs TX-CA. High RPM potential.',
    monthlyRevenuePotential: 14000, source: 'FMCSA Lookup', createdAt: '2026-04-22T08:00:00Z',
  },
  {
    id: 'lead-007', name: 'James "Ironhorse" Sullivan', company: 'Sullivan Hauling LLC',
    phone: '(901) 555-0291', dotNumber: 'DOT-2200118', equipment: 'Reefer',
    trucks: 4, homeState: 'TN', preferredLanes: ['TN-FL', 'Southeast', 'TN-TX'],
    status: 'contacted', assignedTo: 'AI Caller', lastContact: '2026-04-21T09:00:00Z',
    nextFollowUp: '2026-04-23T09:00:00Z',
    notes: 'AI called, went to voicemail. Follow-up scheduled. 4 reefers.',
    monthlyRevenuePotential: 55000, source: 'FMCSA Lookup', createdAt: '2026-04-19T12:00:00Z',
  },
  {
    id: 'lead-008', name: 'Patricia Williams', company: 'Williams Transport Solutions',
    phone: '(713) 555-0834', dotNumber: 'DOT-9912330', equipment: 'Tanker',
    trucks: 6, homeState: 'TX', preferredLanes: ['TX-LA', 'Gulf Coast', 'TX-OK'],
    status: 'lost', assignedTo: 'Sales Team', lastContact: '2026-04-18T14:00:00Z',
    nextFollowUp: null,
    notes: 'Already under contract with another dispatcher. Revisit in 90 days.',
    monthlyRevenuePotential: 88000, source: 'Cold Call', createdAt: '2026-04-12T09:00:00Z',
  },
];

// ─── CALL RECORDS ─────────────────────────────────────────────────────────────

export const MOCK_CALL_RECORDS: CallRecord[] = [
  {
    id: 'call-001', leadId: 'lead-001', leadName: 'Robert Castillo', company: 'Castillo Trucking LLC',
    phone: '(512) 555-0187', type: 'ai_outbound', status: 'completed',
    duration: 423, timestamp: '2026-04-22T10:15:00Z', agentName: 'FC AI Sales Agent',
    outcome: 'Interested — callback scheduled',
    summary: 'AI successfully introduced FleetCommand dispatch services. Bobby runs 3 dry vans on TX-IL lanes. He was skeptical at first but warmed up when AI mentioned RC parsing and real-time tracking. Scheduled a callback with a human sales rep for Thursday 2 PM.',
    transcript: [
      { speaker: 'ai', text: "Hello, is this Robert Castillo with Castillo Trucking?", timestamp: 2 },
      { speaker: 'trucker', text: "Yeah, who's this?", timestamp: 5 },
      { speaker: 'ai', text: "Hi Robert, I'm calling from FleetCommand, a premium dispatch service for owner-operators and small fleets. We specialize in dry van freight on the TX-IL corridor — which I understand is your main lane. Do you have 2 minutes?", timestamp: 7 },
      { speaker: 'trucker', text: "I got a dispatcher already. Not really looking.", timestamp: 18 },
      { speaker: 'ai', text: "Totally understand. Many of our clients said the same thing before seeing what we offer. FleetCommand averages $4.20 per mile on your lanes, and we handle all RC parsing, HOS tracking, and broker communication automatically. Would you be open to comparing what you're currently making versus what we could get you?", timestamp: 21 },
      { speaker: 'trucker', text: "4.20 a mile? That's not bad. What's your cut?", timestamp: 38 },
      { speaker: 'ai', text: "We charge 10% of gross revenue, and you get full transparency through our owner portal — you can see every load, every dollar, in real time. No hidden fees.", timestamp: 43 },
      { speaker: 'trucker', text: "Alright. Can a real person call me Thursday? Around 2?", timestamp: 58 },
      { speaker: 'ai', text: "Absolutely. I'll have Alex from our sales team reach you at this number Thursday at 2 PM. Thanks for your time, Robert!", timestamp: 63 },
    ],
    recordingUrl: '/mock-recordings/call-001.mp3',
  },
  {
    id: 'call-002', leadId: 'lead-007', leadName: 'James Sullivan', company: 'Sullivan Hauling LLC',
    phone: '(901) 555-0291', type: 'ai_outbound', status: 'voicemail',
    duration: 45, timestamp: '2026-04-21T09:05:00Z', agentName: 'FC AI Sales Agent',
    outcome: 'Left voicemail — follow-up text sent',
    summary: 'Called at 9 AM, went to voicemail after 4 rings. AI left a professional 30-second voicemail mentioning reefer freight specialization on TN-FL lanes. Automated follow-up SMS sent.',
    recordingUrl: undefined,
  },
  {
    id: 'call-003', leadId: 'lead-004', leadName: 'Yolanda Kim', company: 'Kim Express Corp',
    phone: '(773) 555-0445', type: 'manual_outbound', status: 'completed',
    duration: 1243, timestamp: '2026-04-21T13:30:00Z', agentName: 'Sales Team',
    outcome: 'Negotiating — fee discussion',
    summary: 'Great 20-minute call with Yolanda. She loves the platform and is ready to bring her 8 trucks over. Main sticking point is dispatch fee — she wants 8% vs our standard 10%. Manager approval needed for exception. Will call back tomorrow with decision.',
    recordingUrl: '/mock-recordings/call-003.mp3',
  },
  {
    id: 'call-004', leadId: 'lead-005', leadName: 'Tony Okafor', company: 'Okafor Fleet Services',
    phone: '(469) 555-0678', type: 'manual_outbound', status: 'completed',
    duration: 892, timestamp: '2026-04-20T10:00:00Z', agentName: 'Sales Team',
    outcome: 'SIGNED — contract executed',
    summary: 'Closing call. Tony signed the dispatch agreement for both his step decks at $1,800/month flat fee. He will send his W9 and MC authority documents by EOD. Onboarding scheduled for April 24th. First load targeted for April 25.',
    recordingUrl: '/mock-recordings/call-004.mp3',
  },
  {
    id: 'call-005', leadId: 'lead-002', leadName: 'Diana Nguyen', company: 'Nguyen Transport Inc.',
    phone: '(214) 555-0334', type: 'ai_outbound', status: 'completed',
    duration: 488, timestamp: '2026-04-21T16:00:00Z', agentName: 'FC AI Sales Agent',
    outcome: 'Warm lead — demo scheduled',
    summary: 'Diana is a reefer operator running TX-CO. Very interested in our load consistency guarantees. AI scheduled a full platform demo for Monday. She mentioned her current dispatcher is slow to respond on weekends — which is a key pain point we can address.',
    transcript: [
      { speaker: 'ai', text: "Hi Diana, this is the FleetCommand AI calling. I'm reaching out because we have consistent reefer freight on the TX-CO corridor that might be a great fit for your truck. Is this a good time?", timestamp: 2 },
      { speaker: 'trucker', text: "Sure, I got a minute. What kind of rates are we talking?", timestamp: 8 },
      { speaker: 'ai', text: "On your TX-CO lane we've been averaging $3.80-$4.10 per mile for reefer. We also guarantee load coverage 6 days a week, with weekend broker communication handled by our AI.", timestamp: 12 },
      { speaker: 'trucker', text: "Weekend coverage? My current guy goes dark on Saturdays. That's actually a big problem for me.", timestamp: 28 },
      { speaker: 'ai', text: "We hear that a lot. With FleetCommand, you have 24/7 AI-assisted dispatch support and a human dispatcher available Mon-Sat. Would you like to see a demo of the driver portal?", timestamp: 35 },
      { speaker: 'trucker', text: "Yeah, set something up. Monday works for me.", timestamp: 52 },
    ],
    recordingUrl: '/mock-recordings/call-005.mp3',
  },
];

// ─── FUEL PRICE MOCK ──────────────────────────────────────────────────────────

export interface FuelPrice {
  region: string;
  price: number;
  change: number; // vs last week
  trend: number[]; // last 4 weeks
  updatedAt: string;
}

export const MOCK_FUEL_PRICES: FuelPrice[] = [
  { region: 'National Average', price: 3.748, change: -0.041, trend: [3.921, 3.889, 3.812, 3.748], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'East Coast', price: 3.812, change: -0.038, trend: [3.989, 3.951, 3.862, 3.812], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'Midwest', price: 3.701, change: -0.055, trend: [3.891, 3.843, 3.769, 3.701], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'Gulf Coast', price: 3.621, change: -0.049, trend: [3.788, 3.752, 3.683, 3.621], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'Rocky Mountain', price: 3.694, change: -0.032, trend: [3.820, 3.798, 3.731, 3.694], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'West Coast', price: 4.112, change: +0.024, trend: [3.998, 4.011, 4.088, 4.112], updatedAt: '2026-04-22T08:00:00Z' },
  { region: 'California', price: 4.389, change: +0.031, trend: [4.241, 4.298, 4.351, 4.389], updatedAt: '2026-04-22T08:00:00Z' },
];

export interface NearbyStation {
  name: string;
  city: string;
  state: string;
  price: number;
  amenities: string[];
  distance: number;
}

export const MOCK_NEARBY_STATIONS: NearbyStation[] = [
  { name: 'Pilot Flying J #1142', city: 'Waco', state: 'TX', price: 3.559, amenities: ['Shower', 'WiFi', 'Scale', 'DEF'], distance: 2.1 },
  { name: 'Love\'s Travel Stop #892', city: 'Temple', state: 'TX', price: 3.571, amenities: ['Shower', 'Scale', 'WiFi'], distance: 8.4 },
  { name: 'TA Petro #344', city: 'Hillsboro', state: 'TX', price: 3.589, amenities: ['Restaurant', 'Shower', 'Repair', 'Scale', 'DEF'], distance: 14.2 },
  { name: 'Pilot #997', city: 'Corsicana', state: 'TX', price: 3.601, amenities: ['Shower', 'WiFi'], distance: 21.8 },
];

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────

export const MOCK_SALES_STATS: SalesDashboardStats = {
  callsToday: 14,
  callsThisWeek: 67,
  leadsThisMonth: 28,
  signedThisMonth: 3,
  conversionRate: 10.7,
  revenueGenerated: 52800,
  pipelineValue: 420000,
};
