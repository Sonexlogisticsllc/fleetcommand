import {
  Load, Driver, HOSData, FinancialSummary,
  ChatThread, DispatcherPerformance,
} from './types';

// ─── LOADS ───────────────────────────────────────────────────────────────────

export const MOCK_LOADS: Load[] = [
  {
    id: 'ld-001', referenceNumber: 'CH-7823941', broker: 'Coyote Logistics',
    brokerId: 'brk-001', commodity: 'Automotive Parts', weight: 42000, miles: 847,
    rate: 3800, ratePerMile: 4.49, status: 'available', driverId: null,
    dispatcherId: 'dsp-001',
    pickup: {
      facility: { name: 'Detroit Auto Suppliers', address: '4401 Michigan Ave', city: 'Detroit', state: 'MI', zip: '48210', timezone: 'EST' },
      scheduledTime: '2026-04-21T08:00:00-04:00', appointmentNumber: 'APT-44201',
    },
    delivery: {
      facility: { name: 'Toyota Plant Nashville', address: '7000 Motor Village Dr', city: 'Nashville', state: 'TN', zip: '37207', timezone: 'CST' },
      scheduledTime: '2026-04-22T14:00:00-05:00', appointmentNumber: 'APT-88932',
    },
    createdAt: '2026-04-18T10:00:00Z', updatedAt: '2026-04-18T10:00:00Z',
  },
  {
    id: 'ld-002', referenceNumber: 'EH-5512899', broker: 'Echo Global Logistics',
    brokerId: 'brk-002', commodity: 'Frozen Food', weight: 38500, miles: 1243,
    rate: 5100, ratePerMile: 4.10, status: 'assigned', driverId: 'drv-001',
    dispatcherId: 'dsp-001',
    pickup: {
      facility: { name: 'Sysco Distribution', address: '200 Corporate Dr', city: 'Houston', state: 'TX', zip: '77038', timezone: 'CST' },
      scheduledTime: '2026-04-20T06:00:00-05:00', appointmentNumber: 'APT-22011',
    },
    delivery: {
      facility: { name: 'Whole Foods Regional DC', address: '1180 N Town Center Dr', city: 'Las Vegas', state: 'NV', zip: '89144', timezone: 'PST' },
      scheduledTime: '2026-04-21T18:00:00-07:00', appointmentNumber: 'APT-77441',
    },
    trackingLink: 'https://track.fleetcommand.io/t/fc-abc123',
    createdAt: '2026-04-17T14:30:00Z', updatedAt: '2026-04-18T09:15:00Z',
  },
  {
    id: 'ld-003', referenceNumber: 'TQ-9900134', broker: 'Total Quality Logistics',
    brokerId: 'brk-003', commodity: 'Medical Equipment', weight: 18000, miles: 312,
    rate: 2100, ratePerMile: 6.73, status: 'in_transit', driverId: 'drv-002',
    dispatcherId: 'dsp-002',
    pickup: {
      facility: { name: 'Medline Industries', address: '3 Lakes Dr', city: 'Northfield', state: 'IL', zip: '60093', timezone: 'CST' },
      scheduledTime: '2026-04-19T09:00:00-05:00', appointmentNumber: 'APT-10211',
    },
    delivery: {
      facility: { name: 'Mayo Clinic Supply', address: '200 First St SW', city: 'Rochester', state: 'MN', zip: '55905', timezone: 'CST' },
      scheduledTime: '2026-04-19T17:00:00-05:00', appointmentNumber: 'APT-55661',
    },
    trackingLink: 'https://track.fleetcommand.io/t/fc-def456',
    createdAt: '2026-04-18T07:00:00Z', updatedAt: '2026-04-19T08:30:00Z',
  },
  {
    id: 'ld-004', referenceNumber: 'XP-3312577', broker: 'XPO Logistics',
    brokerId: 'brk-004', commodity: 'Electronics', weight: 22000, miles: 2156,
    rate: 8500, ratePerMile: 3.94, status: 'delivered', driverId: 'drv-003',
    dispatcherId: 'dsp-001',
    pickup: {
      facility: { name: 'Samsung US Warehouse', address: '105 Challenger Rd', city: 'Ridgefield Park', state: 'NJ', zip: '07660', timezone: 'EST' },
      scheduledTime: '2026-04-15T07:00:00-04:00', appointmentNumber: 'APT-33991',
    },
    delivery: {
      facility: { name: 'Best Buy Distribution', address: '7601 Penn Ave S', city: 'Richfield', state: 'MN', zip: '55423', timezone: 'CST' },
      scheduledTime: '2026-04-17T12:00:00-05:00', appointmentNumber: 'APT-12234',
    },
    rcUrl: '/mock-docs/rc-ld004.pdf',
    bolUrl: '/mock-docs/bol-ld004.pdf',
    podUrl: '/mock-docs/pod-ld004.pdf',
    createdAt: '2026-04-14T12:00:00Z', updatedAt: '2026-04-17T15:00:00Z',
  },
  {
    id: 'ld-005', referenceNumber: 'RX-6671234', broker: 'Roadrunner Freight',
    brokerId: 'brk-005', commodity: 'Steel Coils', weight: 44000, miles: 523,
    rate: 2900, ratePerMile: 5.55, status: 'available', driverId: null,
    dispatcherId: 'dsp-002',
    pickup: {
      facility: { name: 'Nucor Steel', address: '1915 Rexford Rd', city: 'Charlotte', state: 'NC', zip: '28211', timezone: 'EST' },
      scheduledTime: '2026-04-22T10:00:00-04:00', appointmentNumber: 'APT-66123',
    },
    delivery: {
      facility: { name: 'Ford Stamping Plant', address: '2000 Brookpark Rd', city: 'Cleveland', state: 'OH', zip: '44135', timezone: 'EST' },
      scheduledTime: '2026-04-23T08:00:00-04:00', appointmentNumber: 'APT-77891',
    },
    createdAt: '2026-04-18T11:30:00Z', updatedAt: '2026-04-18T11:30:00Z',
  },
  {
    id: 'ld-006', referenceNumber: 'CH-8892341', broker: 'Coyote Logistics',
    brokerId: 'brk-001', commodity: 'General Freight', weight: 35000, miles: 1876,
    rate: 6200, ratePerMile: 3.31, status: 'delivered', driverId: 'drv-004',
    dispatcherId: 'dsp-002',
    pickup: {
      facility: { name: 'Amazon Fulfillment LAX9', address: '2496 Maritime Dr', city: 'Redlands', state: 'CA', zip: '92374', timezone: 'PST' },
      scheduledTime: '2026-04-14T05:00:00-07:00', appointmentNumber: 'APT-99001',
    },
    delivery: {
      facility: { name: 'Amazon Sort Center SAT1', address: '6001 E Stassney Ln', city: 'Austin', state: 'TX', zip: '78744', timezone: 'CST' },
      scheduledTime: '2026-04-16T14:00:00-05:00', appointmentNumber: 'APT-44512',
    },
    rcUrl: '/mock-docs/rc-ld006.pdf',
    bolUrl: '/mock-docs/bol-ld006.pdf',
    podUrl: '/mock-docs/pod-ld006.pdf',
    createdAt: '2026-04-13T09:00:00Z', updatedAt: '2026-04-16T16:30:00Z',
  },
];

// ─── DRIVERS ─────────────────────────────────────────────────────────────────

export const MOCK_DRIVERS: Driver[] = [
  {
    id: 'drv-001', name: 'Marcus Johnson', phone: '(713) 555-0142',
    cdlNumber: 'TX-CDL-4421891', truckId: 'trk-001', truckNumber: 'FC-101',
    status: 'driving',
    currentLocation: { lat: 30.2672, lng: -97.7431, city: 'Austin', state: 'TX' },
  },
  {
    id: 'drv-002', name: 'Sandra Rivera', phone: '(312) 555-0287',
    cdlNumber: 'IL-CDL-8812344', truckId: 'trk-002', truckNumber: 'FC-102',
    status: 'on_duty',
    currentLocation: { lat: 43.6532, lng: -89.7009, city: 'Madison', state: 'WI' },
  },
  {
    id: 'drv-003', name: 'James Whitfield', phone: '(612) 555-0319',
    cdlNumber: 'MN-CDL-3312900', truckId: 'trk-003', truckNumber: 'FC-103',
    status: 'off_duty',
    currentLocation: { lat: 44.9778, lng: -93.2650, city: 'Minneapolis', state: 'MN' },
  },
  {
    id: 'drv-004', name: 'Priya Patel', phone: '(469) 555-0456',
    cdlNumber: 'TX-CDL-7712233', truckId: 'trk-004', truckNumber: 'FC-104',
    status: 'sleeper',
    currentLocation: { lat: 32.7767, lng: -96.7970, city: 'Dallas', state: 'TX' },
  },
];

// ─── HOS DATA ─────────────────────────────────────────────────────────────────

export const MOCK_HOS: Record<string, HOSData> = {
  'drv-001': {
    driverId: 'drv-001', hoursRemaining: 6.5, driveTimeRemaining: 4.5,
    onDutyTimeRemaining: 6.5, cycleHoursUsed: 52.5, cycleHoursRemaining: 17.5,
    nextResetAt: '2026-04-20T06:00:00Z', currentDutyStatus: 'driving', violations: [],
  },
  'drv-002': {
    driverId: 'drv-002', hoursRemaining: 9.25, driveTimeRemaining: 9.25,
    onDutyTimeRemaining: 11.0, cycleHoursUsed: 31.0, cycleHoursRemaining: 39.0,
    nextResetAt: '2026-04-22T08:00:00Z', currentDutyStatus: 'on_duty', violations: [],
  },
  'drv-003': {
    driverId: 'drv-003', hoursRemaining: 11.0, driveTimeRemaining: 11.0,
    onDutyTimeRemaining: 14.0, cycleHoursUsed: 18.0, cycleHoursRemaining: 52.0,
    nextResetAt: '2026-04-25T10:00:00Z', currentDutyStatus: 'off_duty', violations: [],
  },
  'drv-004': {
    driverId: 'drv-004', hoursRemaining: 1.25, driveTimeRemaining: 0.0,
    onDutyTimeRemaining: 1.25, cycleHoursUsed: 68.75, cycleHoursRemaining: 1.25,
    nextResetAt: '2026-04-19T22:00:00Z', currentDutyStatus: 'sleeper',
    violations: ['11-hour drive limit exceeded — must rest'],
  },
};

// ─── FINANCIAL ────────────────────────────────────────────────────────────────

export const MOCK_FINANCIAL: FinancialSummary = {
  perTruck: [
    {
      truckId: 'trk-001', truckNumber: 'FC-101', driverName: 'Marcus Johnson',
      grossRevenue: 48200, fuelCost: 9800, maintenanceCost: 1200, factoringFee: 1446,
      netProfit: 35754, netMarginPct: 74.2, loadsCompleted: 11, milesRun: 12440,
    },
    {
      truckId: 'trk-002', truckNumber: 'FC-102', driverName: 'Sandra Rivera',
      grossRevenue: 39100, fuelCost: 8100, maintenanceCost: 2800, factoringFee: 1173,
      netProfit: 27027, netMarginPct: 69.1, loadsCompleted: 9, milesRun: 10220,
    },
    {
      truckId: 'trk-003', truckNumber: 'FC-103', driverName: 'James Whitfield',
      grossRevenue: 55800, fuelCost: 11200, maintenanceCost: 900, factoringFee: 1674,
      netProfit: 42026, netMarginPct: 75.3, loadsCompleted: 13, milesRun: 15300,
    },
    {
      truckId: 'trk-004', truckNumber: 'FC-104', driverName: 'Priya Patel',
      grossRevenue: 31500, fuelCost: 7200, maintenanceCost: 3400, factoringFee: 945,
      netProfit: 19955, netMarginPct: 63.3, loadsCompleted: 7, milesRun: 8900,
    },
  ],
  weekly: [
    { weekLabel: 'Mar 3', grossRevenue: 38200, fuelCost: 8100, maintenanceCost: 1900, netProfit: 28200 },
    { weekLabel: 'Mar 10', grossRevenue: 42100, fuelCost: 8900, maintenanceCost: 2100, netProfit: 31100 },
    { weekLabel: 'Mar 17', grossRevenue: 39500, fuelCost: 8200, maintenanceCost: 1400, netProfit: 29900 },
    { weekLabel: 'Mar 24', grossRevenue: 51200, fuelCost: 10100, maintenanceCost: 2800, netProfit: 38300 },
    { weekLabel: 'Mar 31', grossRevenue: 47800, fuelCost: 9800, maintenanceCost: 1600, netProfit: 36400 },
    { weekLabel: 'Apr 7', grossRevenue: 43900, fuelCost: 9200, maintenanceCost: 3100, netProfit: 31600 },
    { weekLabel: 'Apr 14', grossRevenue: 58400, fuelCost: 11500, maintenanceCost: 1200, netProfit: 45700 },
    { weekLabel: 'Apr 18', grossRevenue: 34100, fuelCost: 7200, maintenanceCost: 800, netProfit: 26100 },
  ],
  totals: {
    grossRevenue: 174600, fuelCost: 36300, maintenanceCost: 8300,
    netProfit: 124762, activeLoads: 3, loadsThisMonth: 40,
  },
};

// ─── DISPATCHER PERFORMANCE ───────────────────────────────────────────────────

export const MOCK_DISPATCHER_PERFORMANCE: DispatcherPerformance[] = [
  {
    id: 'dsp-001', name: 'Alex Carter', loadsThisWeek: 14, loadsThisMonth: 52,
    grossRevenueGenerated: 98400, baseSalary: 1200, performanceBonus: 2460,
    totalCompensation: 3660, netROI: 94740, avgRatePerMile: 4.21, avgLoadValue: 4827, rank: 1,
  },
  {
    id: 'dsp-002', name: 'Jordan Lee', loadsThisWeek: 11, loadsThisMonth: 43,
    grossRevenueGenerated: 76200, baseSalary: 1200, performanceBonus: 1380,
    totalCompensation: 2580, netROI: 73620, avgRatePerMile: 3.87, avgLoadValue: 3990, rank: 2,
  },
  {
    id: 'dsp-003', name: 'Taylor Brooks', loadsThisWeek: 8, loadsThisMonth: 31,
    grossRevenueGenerated: 52100, baseSalary: 1200, performanceBonus: 0,
    totalCompensation: 1200, netROI: 50900, avgRatePerMile: 3.62, avgLoadValue: 3540, rank: 3,
  },
];

// ─── CHAT THREADS ─────────────────────────────────────────────────────────────

export const MOCK_CHAT_THREADS: ChatThread[] = [
  {
    id: 'thr-001', loadId: 'ld-002', loadReference: 'EH-5512899',
    dispatcherId: 'dsp-001', dispatcherName: 'Alex Carter',
    driverId: 'drv-001', driverName: 'Marcus Johnson',
    lastActivity: '2026-04-18T22:15:00Z', unreadCount: 2,
    aiSummary: 'Marcus is currently en route to Las Vegas, NV. He encountered a 45-min delay near Tucson due to road construction. He anticipates arriving at the Whole Foods DC approximately 1 hour ahead of the 6 PM PST appointment. Fuel stop completed in El Paso. No HOS concerns at this time.',
    messages: [
      { id: 'm1', sender: 'dispatcher', senderName: 'Alex Carter', content: "Marcus, you're confirmed on load EH-5512899. Pickup at Sysco Houston 6 AM tomorrow. Delivery in Las Vegas by 6 PM Thursday.", timestamp: '2026-04-19T09:00:00Z', read: true },
      { id: 'm2', sender: 'driver', senderName: 'Marcus Johnson', content: "Copy that, Alex. I'm about 20 miles out from the Sysco yard. Do I need an appointment number at the guard shack?", timestamp: '2026-04-19T09:14:00Z', read: true },
      { id: 'm3', sender: 'dispatcher', senderName: 'Alex Carter', content: "Yes, tell them APT-22011. They'll direct you to Door 14. Lumper is paid by broker per RC.", timestamp: '2026-04-19T09:16:00Z', read: true },
      { id: 'm4', sender: 'driver', senderName: 'Marcus Johnson', content: "Got it. I'm loaded and sealed. Seal #44812. Departure 7:23 AM local. Heading out.", timestamp: '2026-04-20T12:23:00Z', read: true },
      { id: 'm5', sender: 'system', senderName: 'FleetCommand AI', content: '🛣️ Route update: I-10 W near Tucson AZ — Construction delay, expect +45 min. Alternate route via AZ-86 saves 30 min.', timestamp: '2026-04-20T16:44:00Z', read: true },
      { id: 'm6', sender: 'driver', senderName: 'Marcus Johnson', content: 'Fueled up in El Paso. 110 gallons. Back on the road. Currently in NM near Las Cruces.', timestamp: '2026-04-20T19:10:00Z', read: true },
      { id: 'm7', sender: 'driver', senderName: 'Marcus Johnson', content: 'Hit some construction outside Tucson, that was rough. Running about an hour late but should still beat the appointment. ETA is 5 PM PST.', timestamp: '2026-04-21T14:30:00Z', read: false },
      { id: 'm8', sender: 'driver', senderName: 'Marcus Johnson', content: "I'm at the Whole Foods guard shack now. Gave them APT-77441. They're checking me in.", timestamp: '2026-04-21T16:55:00Z', read: false },
    ],
  },
  {
    id: 'thr-002', loadId: 'ld-003', loadReference: 'TQ-9900134',
    dispatcherId: 'dsp-002', dispatcherName: 'Jordan Lee',
    driverId: 'drv-002', driverName: 'Sandra Rivera',
    lastActivity: '2026-04-19T11:20:00Z', unreadCount: 0,
    aiSummary: 'Sandra successfully picked up the medical equipment load from Medline Industries in Northfield, IL at 9:15 AM CST. She confirmed the appointment number APT-10211 and reported 7 pallets, 18,000 lbs. She is currently in transit to Rochester, MN and is on schedule for the 5 PM delivery at Mayo Clinic.',
    messages: [
      { id: 'm9', sender: 'dispatcher', senderName: 'Jordan Lee', content: "Sandra, you're on load TQ-9900134. Medical equipment — handle with care. Pickup at Medline Northfield IL at 9 AM.", timestamp: '2026-04-19T07:30:00Z', read: true },
      { id: 'm10', sender: 'driver', senderName: 'Sandra Rivera', content: "Confirmed. I'm familiar with Medline, been there before. Do they require a hazmat placard?", timestamp: '2026-04-19T07:45:00Z', read: true },
      { id: 'm11', sender: 'dispatcher', senderName: 'Jordan Lee', content: 'No hazmat on this one. Class 2 medical devices only. Just make sure to bring your PPE for the dock.', timestamp: '2026-04-19T07:48:00Z', read: true },
      { id: 'm12', sender: 'driver', senderName: 'Sandra Rivera', content: 'Loaded and ready. 7 pallets, 18k lbs confirmed. Sealed with #22901. APT-10211 was the ticket. Heading to Rochester now.', timestamp: '2026-04-19T09:22:00Z', read: true },
      { id: 'm13', sender: 'driver', senderName: 'Sandra Rivera', content: 'Delivered to Mayo Clinic. They signed the BOL. Clean delivery, no damage. I\'m ready for my next assignment.', timestamp: '2026-04-19T16:48:00Z', read: true },
    ],
  },
];
