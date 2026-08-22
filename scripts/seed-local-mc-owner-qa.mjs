import { createClient } from '@libsql/client';
import { hash, verify } from '@node-rs/argon2';

const client = createClient({ url: 'file:local.db' });

const mcOwner = {
  id: 'mc-local-qa-001',
  ownerName: 'Mason Carter',
  companyName: 'Carter Highway LLC',
  email: 'mason.carter@sonex.test',
  phone: '(307) 555-0140',
  mcNumber: 'MC-TEST-80421',
  dotNumber: 'DOT-TEST-80421',
  password: 'McOwnerTest2026!',
};

const leasedCarrier = {
  id: 'carrier-local-qa-lease-001',
  firstName: 'Olivia',
  lastName: 'Reed',
  email: 'olivia.reed@operator.test',
  phone: '(307) 555-0141',
  portalEmail: 'olivia.reed@sonex.test',
  password: 'CarrierTest2026!',
};

try {
  const now = new Date().toISOString();
  const [mcOwnerHash, carrierHash] = await Promise.all([
    hash(mcOwner.password),
    hash(leasedCarrier.password),
  ]);

  await client.batch([
    {
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
      args: [mcOwner.id, mcOwner.ownerName, mcOwner.companyName, mcOwner.email, mcOwner.phone, mcOwner.mcNumber, mcOwner.dotNumber, now, now],
    },
    {
      sql: `INSERT INTO carriers (
        id, first_name, last_name, email, phone, address, city, state, zip,
        has_own_authority, mc_number, dot_number, is_leased_mc, mc_holder_name,
        mc_holder_mc, insurance_type, insurance_company, insurance_policy_number,
        mc_owner_id, total_fee_percent, dispatch_fee_percent, status, notes,
        portal_email, joined_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?, 'certificate_holder', ?, ?, ?, 20, 8, 'active', ?, ?, ?, ?)
      ON CONFLICT(portal_email) DO UPDATE SET
        first_name = excluded.first_name, last_name = excluded.last_name,
        email = excluded.email, phone = excluded.phone, address = excluded.address,
        city = excluded.city, state = excluded.state, zip = excluded.zip,
        is_leased_mc = 1, mc_holder_name = excluded.mc_holder_name,
        mc_holder_mc = excluded.mc_holder_mc, mc_owner_id = excluded.mc_owner_id,
        total_fee_percent = 20, dispatch_fee_percent = 8, status = 'active',
        notes = excluded.notes, updated_at = excluded.updated_at`,
      args: [
        leasedCarrier.id, leasedCarrier.firstName, leasedCarrier.lastName, leasedCarrier.email, leasedCarrier.phone,
        '2400 E Lincolnway', 'Cheyenne', 'WY', '82001', mcOwner.companyName, mcOwner.mcNumber,
        'Great West Casualty', 'GW-TEST-80421', mcOwner.id,
        'Local QA leased owner-operator account for MC-owner portal testing.', leasedCarrier.portalEmail, now, now,
      ],
    },
    {
      sql: `INSERT INTO users (id, email, password_hash, role, display_name, carrier_id, mc_owner_id, avatar, created_at, updated_at)
        VALUES (?, ?, ?, 'mc_owner', ?, NULL, ?, 'MC', ?, ?)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'mc_owner',
        display_name = excluded.display_name, carrier_id = NULL, mc_owner_id = excluded.mc_owner_id,
        avatar = 'MC', updated_at = excluded.updated_at`,
      args: ['user-local-qa-mc-owner-001', mcOwner.email, mcOwnerHash, mcOwner.ownerName, mcOwner.id, now, now],
    },
    {
      sql: `INSERT INTO users (id, email, password_hash, role, display_name, carrier_id, mc_owner_id, avatar, created_at, updated_at)
        VALUES (?, ?, ?, 'carrier', ?, ?, NULL, 'OR', ?, ?)
        ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'carrier',
        display_name = excluded.display_name, carrier_id = excluded.carrier_id, mc_owner_id = NULL,
        avatar = 'OR', updated_at = excluded.updated_at`,
      args: ['user-local-qa-carrier-lease-001', leasedCarrier.portalEmail, carrierHash, `${leasedCarrier.firstName} ${leasedCarrier.lastName}`, leasedCarrier.id, now, now],
    },
  ], 'write');

  const accounts = await client.execute({
    sql: `SELECT email, password_hash, role FROM users WHERE email IN (?, ?) ORDER BY role`,
    args: [mcOwner.email, leasedCarrier.portalEmail],
  });
  const verified = await Promise.all(accounts.rows.map(async (account) => verify(
    account.password_hash,
    account.role === 'mc_owner' ? mcOwner.password : leasedCarrier.password,
  )));

  if (accounts.rows.length !== 2 || verified.some((result) => !result)) {
    throw new Error('Local MC-owner QA accounts could not be verified.');
  }

  console.log('Local MC-owner QA fixture is ready.');
  console.log(`MC owner: ${mcOwner.email}`);
  console.log(`Leased owner-operator: ${leasedCarrier.portalEmail}`);
} finally {
  client.close();
}
