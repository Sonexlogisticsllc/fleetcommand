import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL is required.');

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
await client.execute({
  sql: `INSERT OR IGNORE INTO loads
    (id, load_number, carrier_id, broker_name, broker_contact, broker_phone, broker_email,
     pickup_facility, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_date, pickup_time,
     delivery_facility, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_date, delivery_time,
     commodity, weight, miles, rate, dispatch_fee_percent, dispatch_fee_amount, carrier_net, rate_per_mile,
     status, notes, free_time_minutes, detention_hours, detention_rate, detention_revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    'load-carrier-portal-test', 'SNX-PORTAL-TEST-001', 'c0000000-0000-0000-0000-000000000002',
    'Sonex Test Broker', 'Dispatch Desk', '(346) 421-2681', 'dispatch@sonexlogistics.com',
    'Portal Workflow Pickup', '525 Randall Ave Ste 100', 'Cheyenne', 'WY', '82001', '2026-08-12', '08:00',
    'Portal Workflow Delivery', '100 Main Street', 'Denver', 'CO', '80202', '2026-08-13', '14:00',
    'General Freight - Portal Test', 24000, 100, 1200, 10, 120, 1080, 12,
    'dispatched', 'Portal workflow test load: check in, upload BOL, commodity photos, POD, and lumper receipts.', 120, 0, 50, 0,
  ],
});
console.log('Carrier portal test load ensured.');
await client.close();
