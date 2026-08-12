import { createClient } from '@libsql/client';

const client = createClient({ url: 'file:local.db' });
const loadId = 'load-local-qa-001';

await client.batch([
  { sql: 'DELETE FROM cargo_photos WHERE load_id = ?', args: [loadId] },
  { sql: 'DELETE FROM load_checkins WHERE load_id = ?', args: [loadId] },
  {
    sql: `INSERT INTO loads
      (id, load_number, carrier_id, driver_id, broker_name, broker_contact, broker_phone, broker_email,
       pickup_facility, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_date, pickup_time,
       delivery_facility, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_date, delivery_time,
       commodity, weight, miles, rate, dispatch_fee_percent, dispatch_fee_amount, carrier_net, rate_per_mile,
       status, rat_con_url, bol_url, pod_url, notes, free_time_minutes, detention_hours, detention_rate, detention_revenue,
       updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 0, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       carrier_id = excluded.carrier_id,
       driver_id = excluded.driver_id,
       pickup_date = excluded.pickup_date,
       delivery_date = excluded.delivery_date,
       status = excluded.status,
       rat_con_url = NULL,
       bol_url = NULL,
       pod_url = NULL,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`,
    args: [
      loadId,
      'SNX-QA-001',
      'c0000000-0000-0000-0000-000000000002',
      'd0000000-0000-0000-0000-000000000002',
      'Sonex QA Broker',
      'QA Dispatch Desk',
      '(346) 421-2681',
      'dispatch@sonexlogistics.com',
      'Sonex QA Pickup',
      '525 Randall Ave Ste 100',
      'Cheyenne',
      'WY',
      '82001',
      '2026-08-12',
      '08:00',
      'Sonex QA Delivery',
      '1701 Wynkoop Street',
      'Denver',
      'CO',
      '80202',
      '2026-08-13',
      '14:00',
      'QA palletized freight',
      24000,
      104,
      1450,
      10,
      145,
      1305,
      13.94,
      'dispatched',
      'QA-only workflow load. Use for check-ins and BOL, POD, cargo, seal, lumper, and exception uploads.',
      120,
      50,
    ],
  },
], 'write');

console.log('Reset local QA load SNX-QA-001 for Sarah Smith.');
await client.close();
