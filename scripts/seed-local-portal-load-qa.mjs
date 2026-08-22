import { createClient } from '@libsql/client';
import { hash } from '@node-rs/argon2';

const client = createClient({ url: 'file:local.db' });
const ownerPassword = 'McOwnerTest2026!';
const carrierPassword = 'CarrierTest2026!';

const owners = [
  { id: 'mc-local-qa-001', userId: 'user-local-qa-mc-owner-001', name: 'Mason Carter', company: 'Carter Highway LLC', email: 'mason.carter@sonex.test', phone: '(307) 555-0140', mc: 'MC-TEST-80421', dot: 'DOT-TEST-80421' },
  { id: 'mc-local-qa-002', userId: 'user-local-qa-mc-owner-002', name: 'Nadia Brooks', company: 'Brooks Freight Authority LLC', email: 'nadia.brooks@sonex.test', phone: '(307) 555-0142', mc: 'MC-TEST-80422', dot: 'DOT-TEST-80422' },
  { id: 'mc-local-qa-003', userId: 'user-local-qa-mc-owner-003', name: 'Theo Alvarez', company: 'Alvarez Transport Group LLC', email: 'theo.alvarez@sonex.test', phone: '(307) 555-0143', mc: 'MC-TEST-80423', dot: 'DOT-TEST-80423' },
];

const carrierNames = [
  ['Olivia', 'Reed'], ['Liam', 'Bennett'], ['Avery', 'Turner'], ['Noah', 'Foster'], ['Mia', 'Santos'],
  ['Ethan', 'Coleman'], ['Grace', 'Miller'], ['Caleb', 'Morgan'], ['Zoe', 'Patel'], ['Isaac', 'Hughes'],
];

const statuses = ['booked', 'dispatched', 'in_transit', 'delivered', 'pod_received', 'invoiced', 'paid'];
const origins = [
  ['Cheyenne', 'WY', 'Sonex West Distribution'], ['Denver', 'CO', 'Front Range Logistics'], ['Dallas', 'TX', 'Lone Star Freight'],
  ['Kansas City', 'MO', 'Midwest Freight Hub'], ['Phoenix', 'AZ', 'Desert Rail Transfer'],
];
const destinations = [
  ['Salt Lake City', 'UT', 'Wasatch Delivery'], ['Omaha', 'NE', 'Prairie Supply'], ['Austin', 'TX', 'Capitol Warehouse'],
  ['Tulsa', 'OK', 'Green Country Cold Store'], ['Las Vegas', 'NV', 'Silver State Receiving'],
];

function dateForLoad(offset) {
  const date = new Date(Date.UTC(2026, 7, 1 + (offset % 28)));
  return date.toISOString().slice(0, 10);
}

try {
  const now = new Date().toISOString();
  const [ownerHash, carrierHash] = await Promise.all([hash(ownerPassword), hash(carrierPassword)]);

  for (const owner of owners) {
    await client.execute({
      sql: `INSERT INTO mc_owners (
        id, owner_name, company_name, email, phone, mc_number, dot_number,
        can_manage_leased_carriers, primary_carrier_id, default_total_fee_percent,
        default_dispatch_fee_percent, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, 20, 8, 'active', ?, ?)
      ON CONFLICT(mc_number) DO UPDATE SET
        owner_name = excluded.owner_name, company_name = excluded.company_name,
        email = excluded.email, phone = excluded.phone, dot_number = excluded.dot_number,
        can_manage_leased_carriers = 1, default_total_fee_percent = 20,
        default_dispatch_fee_percent = 8, status = 'active', updated_at = excluded.updated_at`,
      args: [owner.id, owner.name, owner.company, owner.email, owner.phone, owner.mc, owner.dot, now, now],
    });
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, role, display_name, carrier_id, mc_owner_id, avatar, created_at, updated_at)
        VALUES (?, ?, ?, 'mc_owner', ?, NULL, ?, 'MO', ?, ?)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'mc_owner',
        display_name = excluded.display_name, carrier_id = NULL, mc_owner_id = excluded.mc_owner_id,
        avatar = 'MO', updated_at = excluded.updated_at`,
      args: [owner.userId, owner.email, ownerHash, owner.name, owner.id, now, now],
    });
  }

  const carriers = carrierNames.map(([firstName, lastName], index) => {
    const owner = owners[index % owners.length];
    const portalEmail = index === 0 ? 'olivia.reed@sonex.test' : `${firstName}.${lastName}`.toLowerCase() + '@sonex.test';
    return {
      id: index === 0 ? 'carrier-local-qa-lease-001' : `carrier-local-qa-lease-${String(index + 1).padStart(3, '0')}`,
      userId: index === 0 ? 'user-local-qa-carrier-lease-001' : `user-local-qa-carrier-lease-${String(index + 1).padStart(3, '0')}`,
      firstName, lastName, portalEmail, owner, index,
    };
  });

  for (const carrier of carriers) {
    const displayName = `${carrier.firstName} ${carrier.lastName}`;
    await client.execute({
      sql: `INSERT INTO carriers (
        id, first_name, last_name, email, phone, address, city, state, zip,
        has_own_authority, mc_number, dot_number, is_leased_mc, mc_holder_name,
        mc_holder_mc, insurance_type, insurance_company, insurance_policy_number,
        mc_owner_id, total_fee_percent, dispatch_fee_percent, status, notes,
        portal_email, joined_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?, 'certificate_holder', ?, ?, ?, 20, 8, 'active', ?, ?, ?, ?)
      ON CONFLICT(portal_email) DO UPDATE SET
        first_name = excluded.first_name, last_name = excluded.last_name, email = excluded.email,
        phone = excluded.phone, address = excluded.address, city = excluded.city,
        state = excluded.state, zip = excluded.zip, is_leased_mc = 1,
        mc_holder_name = excluded.mc_holder_name, mc_holder_mc = excluded.mc_holder_mc,
        mc_owner_id = excluded.mc_owner_id, total_fee_percent = 20,
        dispatch_fee_percent = 8, status = 'active', notes = excluded.notes,
        updated_at = excluded.updated_at`,
      args: [
        carrier.id, carrier.firstName, carrier.lastName, `${carrier.firstName}.${carrier.lastName}`.toLowerCase() + '@operator.test',
        `(307) 555-${String(150 + carrier.index).padStart(4, '0')}`, '2400 E Lincolnway', 'Cheyenne', 'WY', '82001',
        carrier.owner.company, carrier.owner.mc, 'Great West Casualty', `GW-QA-${String(carrier.index + 1).padStart(4, '0')}`,
        carrier.owner.id, `Local QA leased owner-operator under ${carrier.owner.company}.`, carrier.portalEmail, now, now,
      ],
    });
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, role, display_name, carrier_id, mc_owner_id, avatar, created_at, updated_at)
        VALUES (?, ?, ?, 'carrier', ?, ?, NULL, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'carrier',
        display_name = excluded.display_name, carrier_id = excluded.carrier_id, mc_owner_id = NULL,
        avatar = excluded.avatar, updated_at = excluded.updated_at`,
      args: [carrier.userId, carrier.portalEmail, carrierHash, displayName, carrier.id, `${carrier.firstName[0]}${carrier.lastName[0]}`, now, now],
    });
  }

  const loadStatements = [];
  for (const carrier of carriers) {
    for (let index = 0; index < 100; index += 1) {
      const origin = origins[(carrier.index + index) % origins.length];
      const destination = destinations[(carrier.index + index + 2) % destinations.length];
      const rate = 1350 + carrier.index * 35 + (index % 12) * 75;
      const miles = 410 + (index % 8) * 83;
      const totalFee = Number((rate * 0.2).toFixed(2));
      const dispatchFee = Number((rate * 0.08).toFixed(2));
      const mcOwnerFee = Number((rate * 0.12).toFixed(2));
      const carrierNet = Number((rate - totalFee).toFixed(2));
      const pickupDate = dateForLoad(carrier.index * 3 + index);
      const deliveryDate = dateForLoad(carrier.index * 3 + index + 2);
      const loadNumber = `QA-${String(carrier.index + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`;
      loadStatements.push({
        sql: `INSERT INTO loads (
          id, load_number, carrier_id, mc_owner_id, broker_name, broker_contact, broker_phone, broker_email,
          pickup_facility, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_date, pickup_time,
          delivery_facility, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_date, delivery_time,
          commodity, weight, miles, rate, total_fee_percent, total_fee_amount, dispatch_fee_percent,
          dispatch_fee_amount, mc_owner_fee_amount, carrier_net, rate_per_mile, status, notes,
          free_time_minutes, detention_hours, detention_rate, detention_revenue
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 20, ?, 8, ?, ?, ?, ?, ?, ?, 120, 0, 50, 0)
        ON CONFLICT(load_number) DO UPDATE SET
          carrier_id = excluded.carrier_id, mc_owner_id = excluded.mc_owner_id, pickup_date = excluded.pickup_date,
          delivery_date = excluded.delivery_date, rate = excluded.rate, total_fee_amount = excluded.total_fee_amount,
          dispatch_fee_amount = excluded.dispatch_fee_amount, mc_owner_fee_amount = excluded.mc_owner_fee_amount,
          carrier_net = excluded.carrier_net, rate_per_mile = excluded.rate_per_mile, status = excluded.status,
          updated_at = CURRENT_TIMESTAMP`,
        args: [
          `load-local-qa-${String(carrier.index + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`,
          loadNumber, carrier.id, carrier.owner.id, 'Sonex QA Broker', 'QA Dispatch Desk', '(307) 555-0199', 'dispatch@sonex.test',
          origin[2], '100 Operations Way', origin[0], origin[1], '82001', pickupDate, '08:00',
          destination[2], '500 Receiving Road', destination[0], destination[1], '84101', deliveryDate, '14:00',
          index % 3 === 0 ? 'Palletized food products' : index % 3 === 1 ? 'General dry freight' : 'Building materials',
          22000 + (index % 7) * 1200, miles, rate, totalFee, dispatchFee, mcOwnerFee, carrierNet,
          Number((rate / miles).toFixed(2)), statuses[(carrier.index * 3 + index) % statuses.length],
          'Generated local QA load for portal scope and financial testing.',
        ],
      });
    }
  }

  for (let index = 0; index < loadStatements.length; index += 100) {
    await client.batch(loadStatements.slice(index, index + 100), 'write');
  }

  const [ownerCount, carrierCount, loadCount] = await Promise.all([
    client.execute("SELECT COUNT(*) AS count FROM mc_owners WHERE mc_number LIKE 'MC-TEST-%'"),
    client.execute("SELECT COUNT(*) AS count FROM carriers WHERE portal_email LIKE '%@sonex.test'"),
    client.execute("SELECT COUNT(*) AS count FROM loads WHERE load_number LIKE 'QA-%'"),
  ]);
  console.log(`Local QA data ready: ${ownerCount.rows[0].count} MC owners, ${carrierCount.rows[0].count} leased carriers, ${loadCount.rows[0].count} loads.`);
} finally {
  client.close();
}
