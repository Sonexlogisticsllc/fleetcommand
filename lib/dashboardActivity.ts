export type DashboardActivityLoad = {
  pickupDate: string;
  deliveryDate: string;
  status: string;
};

// Sonex dispatch operates from Cheyenne, so dashboard dates follow Mountain
// Time instead of the Vercel runtime's UTC clock.
const OPERATION_TIME_ZONE = 'America/Denver';

export function operationalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildTodayActivity<T extends DashboardActivityLoad>(loads: T[], now = new Date()) {
  const today = operationalDateKey(now);
  return {
    pickups: loads.filter(load => load.pickupDate === today && ['booked', 'dispatched', 'in_transit'].includes(load.status)),
    deliveries: loads.filter(load => load.deliveryDate === today && load.status === 'in_transit'),
  };
}
