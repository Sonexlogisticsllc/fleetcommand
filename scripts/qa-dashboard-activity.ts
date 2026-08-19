import assert from 'node:assert/strict';
import { buildTodayActivity, operationalDateKey } from '../lib/dashboardActivity';

const morningInDenver = new Date('2026-08-19T15:00:00.000Z');
const today = operationalDateKey(morningInDenver);

const activity = buildTodayActivity([
  { pickupDate: today, deliveryDate: '2026-08-20', status: 'booked', id: 'pickup-booked' },
  { pickupDate: today, deliveryDate: today, status: 'in_transit', id: 'pickup-and-delivery' },
  { pickupDate: today, deliveryDate: today, status: 'delivered', id: 'not-active' },
  { pickupDate: '2026-08-18', deliveryDate: today, status: 'dispatched', id: 'not-delivery-yet' },
], morningInDenver);

assert.deepEqual(activity.pickups.map(load => load.id), ['pickup-booked', 'pickup-and-delivery']);
assert.deepEqual(activity.deliveries.map(load => load.id), ['pickup-and-delivery']);

console.log('Dashboard activity QA passed.');
