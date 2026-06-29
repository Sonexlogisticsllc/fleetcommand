-- ─── FLEETCOMMAND TMS — MOCK DATA SEED ────────────────────────────────────────

-- NOTE: Ensure public.carriers is seeded first before public.users or public.loads.

-- 1. SEED CARRIERS
INSERT INTO public.carriers (
    id, first_name, last_name, email, phone, equipment_type, truck_year, truck_make,
    truck_model, truck_vin, truck_plate, truck_state, weight_capacity,
    has_trailer, trailer_type, trailer_vin, trailer_plate, trailer_state, trailer_length,
    has_own_authority, mc_number, dot_number, is_leased_mc, mc_holder_name, mc_holder_mc,
    insurance_type, insurance_company, insurance_policy_number, dispatch_fee_percent,
    status, notes, portal_email
) VALUES (
    'c0000000-0000-0000-0000-000000000001', 'John', 'Doe', 'john.doe@carrier.com', '(512) 555-0101', 'dry_van', 2022, 'Freightliner',
    'Cascadia', '1FVACWDB8NHXXXXXX', 'TX12345', 'TX', 45000,
    true, 'Dry Van', '53TRVINXXXXXXXXXX', 'TR98765', 'TX', 53,
    true, 'MC123456', 'DOT3456789', false, NULL, NULL,
    'vin_scheduled', 'Progressive Commercial', 'POL-12345678', 8,
    'active', 'Highly reliable dry van owner operator.', 'john@sonexcarrier.com'
), (
    'c0000000-0000-0000-0000-000000000002', 'Sarah', 'Smith', 'sarah.smith@logistics.com', '(415) 555-0202', 'reefer', 2023, 'Peterbilt',
    '579', '1XP5D49X5NDXXXXXX', 'CA67890', 'CA', 44000,
    true, 'Reefer', '53RFVINXXXXXXXXXX', 'RF45678', 'CA', 53,
    false, NULL, NULL, true, 'Unified Logistics LLC', 'MC987654',
    'certificate_holder', 'Great West Catalog', 'GWC-98765432', 10,
    'active', 'Temperature controlled load specialist.', 'sarah@sonexcarrier.com'
) ON CONFLICT (id) DO NOTHING;


-- 2. SEED LOADS
INSERT INTO public.loads (
    id, load_number, carrier_id, broker_name, broker_contact, broker_phone, broker_email, broker_mc,
    pickup_facility, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_date, pickup_time, pickup_appt_number,
    delivery_facility, delivery_address, delivery_city, delivery_state, delivery_zip, delivery_date, delivery_time, delivery_appt_number,
    commodity, weight, miles, rate, dispatch_fee_percent, dispatch_fee_amount, carrier_net, rate_per_mile,
    status, notes
) VALUES (
    'l0000000-0000-0000-0000-000000000001', 'SNX-2026-001', 'c0000000-0000-0000-0000-000000000001',
    'C.H. Robinson', 'Mark Davis', '(800) 323-7587', 'mark.davis@chrobinson.com', 'MC-1234',
    'PepsiCo Warehouse', '1200 Beverage Dr', 'Dallas', 'TX', '75201', '2026-06-29', '08:00', 'APPT-1002',
    'Walmart DC 6012', '500 Distribution Rd', 'Houston', 'TX', '77001', '2026-06-29', '14:00', 'APPT-5542',
    'Beverages (Soda)', 42000, 240, 950.00, 8.00, 76.00, 874.00, 3.96,
    'booked', 'Must maintain proper check-in times.'
), (
    'l0000000-0000-0000-0000-000000000002', 'SNX-2026-002', 'c0000000-0000-0000-0000-000000000002',
    'TQL', 'Jessica Miller', '(800) 580-3101', 'jmiller@tql.com', 'MC-5678',
    'Tyson Foods', '400 Poultry Way', 'Springdale', 'AR', '72764', '2026-06-29', '06:00', 'PU-99182',
    'Kroger Distribution', '101 Grocery Ln', 'Cincinnati', 'OH', '45201', '2026-06-30', '10:00', 'DEL-33821',
    'Frozen Poultry', 40000, 650, 2400.00, 10.00, 240.00, 2160.00, 3.69,
    'in_transit', 'Maintain temperature at -10°F. Pre-cool trailer.'
) ON CONFLICT (id) DO NOTHING;


-- 3. SEED CHECK-INS
INSERT INTO public.load_checkins (
    load_id, event, timestamp, notes, logged_by
) VALUES (
    'l0000000-0000-0000-0000-000000000002', 'arrived_pickup', '2026-06-29 05:45:00+00', 'Driver arrived at Tyson Foods pickup facility early.', 'carrier'
), (
    'l0000000-0000-0000-0000-000000000002', 'loaded_departing', '2026-06-29 07:15:00+00', 'Loaded, trailer sealed #481992. Departing Tyson.', 'carrier'
);


-- 4. SEED MESSAGES
INSERT INTO public.messages (
    carrier_id, sender_name, sender_role, message_text, read, created_at
) VALUES (
    'c0000000-0000-0000-0000-000000000001', 'Sonex Dispatch', 'admin', 'Welcome to the Sonex Dispatch Hub! You can view your loads, log checkins, and upload PODs here.', true, '2026-06-28 10:00:00+00'
), (
    'c0000000-0000-0000-0000-000000000001', 'John Doe', 'carrier', 'Thanks! Excited to work together. Staging my truck now for the Pepsi load tomorrow.', true, '2026-06-28 10:15:00+00'
), (
    'c0000000-0000-0000-0000-000000000001', 'Sonex Dispatch', 'admin', 'Sounds good, let us know if you need anything else.', false, '2026-06-28 10:20:00+00'
);


-- 5. SEED INSTRUCTIONS FOR AUTH.USERS (PROFILE SYNCS)
-- Note: To sign in, users must be registered in auth.users.
-- Running the queries below will create auth.users which automatically populates public.users through the trigger.
-- Run this in your SQL editor to create the admin user:
/*
-- 1. Create Admin User (dispatch@sonexlogistics.com / sonex2026)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'dispatch@sonexlogistics.com',
    crypt('sonex2026', gen_salt('bf')),
    now(),
    NULL,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin","displayName":"Sonex Dispatch","avatar":"SD"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 2. Create Carrier User 1 (john@sonexcarrier.com / carrier2026)
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111112',
    'authenticated',
    'authenticated',
    'john@sonexcarrier.com',
    crypt('carrier2026', gen_salt('bf')),
    now(),
    NULL,
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"carrier","displayName":"John Doe","carrierId":"c0000000-0000-0000-0000-000000000001","avatar":"JD"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;
*/
