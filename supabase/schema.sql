-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. CARRIERS TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carriers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    address text,
    city text,
    state text,
    zip text,
    equipment_type text NOT NULL,
    truck_year integer NOT NULL,
    truck_make text NOT NULL,
    truck_model text NOT NULL,
    truck_vin text NOT NULL,
    truck_plate text NOT NULL,
    truck_state text NOT NULL,
    weight_capacity integer NOT NULL,
    has_trailer boolean NOT NULL DEFAULT false,
    trailer_type text,
    trailer_vin text,
    trailer_plate text,
    trailer_state text,
    trailer_length integer,
    has_own_authority boolean NOT NULL DEFAULT false,
    mc_number text,
    dot_number text,
    is_leased_mc boolean NOT NULL DEFAULT false,
    mc_holder_name text,
    mc_holder_mc text,
    insurance_type text NOT NULL,
    insurance_company text,
    insurance_policy_number text,
    dispatch_fee_percent numeric NOT NULL DEFAULT 10,
    status text NOT NULL DEFAULT 'onboarding',
    notes text NOT NULL DEFAULT '',
    portal_email text UNIQUE NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 2. USERS (PROFILES) TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'carrier')),
    display_name text NOT NULL,
    carrier_id uuid REFERENCES public.carriers(id) ON DELETE SET NULL,
    avatar text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 3. LOADS TABLE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.loads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    load_number text UNIQUE NOT NULL,
    carrier_id uuid REFERENCES public.carriers(id) ON DELETE CASCADE,
    broker_name text NOT NULL,
    broker_contact text NOT NULL,
    broker_phone text NOT NULL,
    broker_email text,
    broker_mc text,
    pickup_facility text NOT NULL,
    pickup_address text NOT NULL,
    pickup_city text NOT NULL,
    pickup_state text NOT NULL,
    pickup_zip text NOT NULL,
    pickup_date date NOT NULL,
    pickup_time text NOT NULL,
    pickup_appt_number text,
    delivery_facility text NOT NULL,
    delivery_address text NOT NULL,
    delivery_city text NOT NULL,
    delivery_state text NOT NULL,
    delivery_zip text NOT NULL,
    delivery_date date NOT NULL,
    delivery_time text NOT NULL,
    delivery_appt_number text,
    commodity text NOT NULL,
    weight integer NOT NULL,
    miles numeric NOT NULL,
    rate numeric NOT NULL,
    dispatch_fee_percent numeric NOT NULL,
    dispatch_fee_amount numeric NOT NULL,
    carrier_net numeric NOT NULL,
    rate_per_mile numeric NOT NULL,
    status text NOT NULL DEFAULT 'booked',
    rat_con_url text,
    bol_url text,
    pod_url text,
    notes text NOT NULL DEFAULT '',
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 4. LOAD CHECK-INS TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.load_checkins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id uuid REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,
    event text NOT NULL,
    timestamp timestamp with time zone DEFAULT now() NOT NULL,
    notes text NOT NULL DEFAULT '',
    logged_by text NOT NULL CHECK (logged_by IN ('admin', 'carrier'))
);

-- ─── 5. CARGO PHOTOS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    load_id uuid REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,
    url text NOT NULL,
    stage text NOT NULL CHECK (stage IN ('pickup', 'delivery')),
    caption text NOT NULL DEFAULT '',
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    uploaded_by text NOT NULL CHECK (uploaded_by IN ('admin', 'carrier'))
);

-- ─── 6. MESSAGES TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id uuid REFERENCES public.carriers(id) ON DELETE CASCADE NOT NULL,
    sender_id uuid,
    sender_name text NOT NULL,
    sender_role text NOT NULL CHECK (sender_role IN ('admin', 'carrier')),
    message_text text NOT NULL,
    attachment_url text,
    attachment_type text CHECK (attachment_type IN ('image', 'document')),
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 7. SETTLEMENTS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carrier_id uuid REFERENCES public.carriers(id) ON DELETE CASCADE NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    load_ids uuid[] NOT NULL,
    gross_total numeric NOT NULL,
    fee_total numeric NOT NULL,
    net_total numeric NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ─── 8. SYSTEM SETTINGS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name text NOT NULL,
    company_address text,
    company_city text,
    company_state text,
    company_zip text,
    company_email text,
    company_phone text,
    default_dispatch_fee_percent numeric NOT NULL DEFAULT 10,
    admin_users jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Insert default settings row
INSERT INTO public.settings (
    company_name, company_address, company_city, company_state, company_zip, company_email, company_phone, default_dispatch_fee_percent
) VALUES (
    'Sonex Logistics LLC', '525 Randall Ave Ste 100', 'Cheyenne', 'WY', '82001', 'dispatch@sonexlogistics.com', '(346) 421-2681', 10
) ON CONFLICT (id) DO NOTHING;


-- ─── ROW LEVEL SECURITY (RLS) POLICIES ────────────────────────────────────────

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.load_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_carrier_id()
RETURNS uuid AS $$
  SELECT carrier_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Admins have full access on users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins have full access on carriers" ON public.carriers;
DROP POLICY IF EXISTS "Carriers can view their own profile" ON public.carriers;
DROP POLICY IF EXISTS "Admins have full access on loads" ON public.loads;
DROP POLICY IF EXISTS "Carriers can view their own loads" ON public.loads;
DROP POLICY IF EXISTS "Carriers can update their own loads" ON public.loads;
DROP POLICY IF EXISTS "Admins have full access on load_checkins" ON public.load_checkins;
DROP POLICY IF EXISTS "Carriers can view check-ins of their own loads" ON public.load_checkins;
DROP POLICY IF EXISTS "Carriers can add check-ins for their own loads" ON public.load_checkins;
DROP POLICY IF EXISTS "Admins have full access on cargo_photos" ON public.cargo_photos;
DROP POLICY IF EXISTS "Carriers can view cargo photos of their own loads" ON public.cargo_photos;
DROP POLICY IF EXISTS "Carriers can upload cargo photos for their own loads" ON public.cargo_photos;
DROP POLICY IF EXISTS "Admins have full access on messages" ON public.messages;
DROP POLICY IF EXISTS "Carriers can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Carriers can send messages in their thread" ON public.messages;
DROP POLICY IF EXISTS "Admins have full access on settlements" ON public.settlements;
DROP POLICY IF EXISTS "Carriers can view their own settlements" ON public.settlements;
DROP POLICY IF EXISTS "Anyone authenticated can read settings" ON public.settings;
DROP POLICY IF EXISTS "Only admins can update settings" ON public.settings;

-- Create policies
CREATE POLICY "Admins have full access on users" ON public.users FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Users can read their own profile" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins have full access on carriers" ON public.carriers FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view their own profile" ON public.carriers FOR SELECT TO authenticated USING (id = public.get_my_carrier_id());
CREATE POLICY "Admins have full access on loads" ON public.loads FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view their own loads" ON public.loads FOR SELECT TO authenticated USING (carrier_id = public.get_my_carrier_id());
CREATE POLICY "Carriers can update their own loads" ON public.loads FOR UPDATE TO authenticated USING (carrier_id = public.get_my_carrier_id());
CREATE POLICY "Admins have full access on load_checkins" ON public.load_checkins FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view check-ins of their own loads" ON public.load_checkins FOR SELECT TO authenticated USING (load_id IN (SELECT id FROM public.loads WHERE carrier_id = public.get_my_carrier_id()));
CREATE POLICY "Carriers can add check-ins for their own loads" ON public.load_checkins FOR INSERT TO authenticated WITH CHECK (load_id IN (SELECT id FROM public.loads WHERE carrier_id = public.get_my_carrier_id()));
CREATE POLICY "Admins have full access on cargo_photos" ON public.cargo_photos FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view cargo photos of their own loads" ON public.cargo_photos FOR SELECT TO authenticated USING (load_id IN (SELECT id FROM public.loads WHERE carrier_id = public.get_my_carrier_id()));
CREATE POLICY "Carriers can upload cargo photos for their own loads" ON public.cargo_photos FOR INSERT TO authenticated WITH CHECK (load_id IN (SELECT id FROM public.loads WHERE carrier_id = public.get_my_carrier_id()));
CREATE POLICY "Admins have full access on messages" ON public.messages FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view their own messages" ON public.messages FOR SELECT TO authenticated USING (carrier_id = public.get_my_carrier_id());
CREATE POLICY "Carriers can send messages in their thread" ON public.messages FOR INSERT TO authenticated WITH CHECK (carrier_id = public.get_my_carrier_id());
CREATE POLICY "Admins have full access on settlements" ON public.settlements FOR ALL TO authenticated USING (public.get_my_role() = 'admin');
CREATE POLICY "Carriers can view their own settlements" ON public.settlements FOR SELECT TO authenticated USING (carrier_id = public.get_my_carrier_id());
CREATE POLICY "Anyone authenticated can read settings" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can update settings" ON public.settings FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');


-- ─── 9. AUTH USER CREATED TRIGGER SYNC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, role, display_name, carrier_id, avatar)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'carrier'),
    COALESCE(new.raw_user_meta_data->>'displayName', 'New User'),
    CASE 
      WHEN new.raw_user_meta_data->>'carrierId' IS NOT NULL AND new.raw_user_meta_data->>'carrierId' <> ''
      THEN (new.raw_user_meta_data->>'carrierId')::uuid 
      ELSE NULL 
    END,
    COALESCE(new.raw_user_meta_data->>'avatar', 'NU')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Force schema reload
NOTIFY pgrst, 'reload schema';
