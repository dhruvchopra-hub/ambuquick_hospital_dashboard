-- ============================================================
-- AmbuQuick Hospital Partner Dashboard — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Create Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  city TEXT,
  partner_since DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  hospital_id UUID REFERENCES public.hospitals(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BLS',
  driver_name TEXT,
  driver_phone TEXT,
  driver_pin TEXT,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'on_trip', 'maintenance', 'offline')),
  hospital_id UUID REFERENCES public.hospitals(id),
  is_hospital_fleet BOOLEAN DEFAULT FALSE,
  lat DECIMAL(10, 8) DEFAULT 28.6139,
  lng DECIMAL(11, 8) DEFAULT 77.2090,
  reg_number TEXT,
  last_service_date DATE,
  next_service_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(id),
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_age INTEGER,
  patient_gender TEXT CHECK (patient_gender IN ('Male', 'Female', 'Other')),
  chief_complaint TEXT,
  pickup_location TEXT NOT NULL,
  destination TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('Critical', 'Urgent', 'Scheduled')),
  ambulance_id UUID REFERENCES public.ambulances(id),
  driver_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatched', 'en_route', 'completed', 'cancelled')),
  response_time_minutes INTEGER,
  amount DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES public.hospitals(id),
  period_label TEXT NOT NULL,
  total_rides INTEGER DEFAULT 0,
  subtotal DECIMAL(10, 2) DEFAULT 0,
  gst DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  rate DECIMAL(10, 2),
  amount DECIMAL(10, 2)
);


-- STEP 2: Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;


-- STEP 3: Row Level Security (RLS)
-- ============================================================
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get the current user's hospital_id
CREATE OR REPLACE FUNCTION public.get_my_hospital_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT hospital_id FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Policies: hospitals
CREATE POLICY "hospital: own record" ON public.hospitals
  FOR SELECT USING (id = public.get_my_hospital_id());

-- Policies: user_profiles
CREATE POLICY "profile: own record" ON public.user_profiles
  FOR ALL USING (user_id = auth.uid());

-- Policies: ambulances
CREATE POLICY "ambulances: own hospital" ON public.ambulances
  FOR ALL USING (hospital_id = public.get_my_hospital_id());

-- Policies: rides
CREATE POLICY "rides: own hospital" ON public.rides
  FOR ALL USING (hospital_id = public.get_my_hospital_id());

-- Policies: invoices
CREATE POLICY "invoices: own hospital" ON public.invoices
  FOR ALL USING (hospital_id = public.get_my_hospital_id());

-- Policies: invoice_items
CREATE POLICY "invoice_items: own hospital" ON public.invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM public.invoices WHERE hospital_id = public.get_my_hospital_id()
    )
  );


-- STEP 4: Function for new hospital signup (called from Create Account page)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_hospital_for_user(
  hospital_name TEXT,
  hospital_email TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_hospital_id UUID;
BEGIN
  INSERT INTO public.hospitals (name, email)
  VALUES (hospital_name, hospital_email)
  RETURNING id INTO new_hospital_id;

  INSERT INTO public.user_profiles (user_id, hospital_id)
  VALUES (auth.uid(), new_hospital_id)
  ON CONFLICT (user_id) DO UPDATE SET hospital_id = new_hospital_id;
END;
$$;


-- STEP 5: Auto-link trigger
-- When user signs up with an email matching a hospital's email,
-- automatically link them to that hospital.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, hospital_id)
  SELECT NEW.id, h.id
  FROM public.hospitals h
  WHERE h.email = NEW.email
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- STEP 5: Seed Demo Data
-- ============================================================

-- Demo hospital
INSERT INTO public.hospitals (id, name, contact_person, email, city, partner_since)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Ujala Cygnus Hospital',
  'Kripal Negi',
  'demo@ujala.com',
  'New Delhi',
  '2023-01-15'
) ON CONFLICT (id) DO NOTHING;


-- Ambulances (2 AmbuQuick + 2 Hospital fleet)
INSERT INTO public.ambulances (id, code, type, driver_name, driver_phone, driver_pin, status, hospital_id, is_hospital_fleet, lat, lng, reg_number, last_service_date, next_service_date)
VALUES
  ('bbbbbbbb-0001-0000-0000-000000000001', 'AQ-DL-001', 'BLS', 'Rajesh Kumar', '9876543201', '4821', 'available',   'aaaaaaaa-0000-0000-0000-000000000001', FALSE, 28.6139, 77.2090, 'DL 4C AB 1234', '2026-01-10', '2026-07-10'),
  ('bbbbbbbb-0002-0000-0000-000000000002', 'AQ-DL-002', 'ALS', 'Sunil Sharma', '9876543202', '7364', 'on_trip',     'aaaaaaaa-0000-0000-0000-000000000001', FALSE, 28.6320, 77.2185, 'DL 4C AB 1235', '2025-12-05', '2026-06-05'),
  ('bbbbbbbb-0003-0000-0000-000000000003', 'UC-DL-001', 'hospital_fleet', 'Dinesh Verma', '9876543203', '2958', 'available',   'aaaaaaaa-0000-0000-0000-000000000001', TRUE,  28.6050, 77.2100, 'DL 5C UC 3341', '2026-02-20', '2026-08-20'),
  ('bbbbbbbb-0004-0000-0000-000000000004', 'UC-DL-002', 'hospital_fleet', 'Mohan Lal',   '9876543204', '6173', 'maintenance', 'aaaaaaaa-0000-0000-0000-000000000001', TRUE,  28.6150, 77.1950, 'DL 5C UC 3342', '2025-11-15', '2026-05-15')
ON CONFLICT (id) DO NOTHING;


-- 20 demo rides across the last 3 months
INSERT INTO public.rides (id, hospital_id, patient_name, patient_phone, pickup_location, destination, urgency, ambulance_id, driver_name, status, response_time_minutes, amount, created_at)
VALUES
  -- March 2025
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Arjun Mehta',     '9811000001', 'Rohini Sector 15',      'Ujala Cygnus Hospital', 'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  9,  2500, NOW() - INTERVAL '1 day'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Sunita Yadav',    '9811000002', 'Pitampura Main Road',   'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  14, 1800, NOW() - INTERVAL '2 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Vikram Singh',    '9811000003', 'Dwarka Sector 12',      'AIIMS Delhi',           'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  21, 2500, NOW() - INTERVAL '3 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Priti Gupta',     '9811000004', 'Model Town',            'Ujala Cygnus Hospital', 'Scheduled', 'bbbbbbbb-0003-0000-0000-000000000003', 'Dinesh Verma', 'completed',  28, 1200, NOW() - INTERVAL '4 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Rahul Kapoor',    '9811000005', 'Shalimar Bagh',         'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  16, 1800, NOW() - INTERVAL '5 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Anita Bose',      '9811000006', 'Ashok Vihar',           'Fortis Hospital',       'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  11, 2500, NOW() - INTERVAL '6 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Deepak Joshi',    '9811000007', 'Janakpuri C Block',     'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'en_route',   NULL, 1800, NOW() - INTERVAL '3 hours'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Kavya Nair',      '9811000008', 'Vasant Kunj',           'AIIMS Delhi',           'Scheduled', 'bbbbbbbb-0003-0000-0000-000000000003', 'Dinesh Verma', 'dispatched', NULL, 1200, NOW() - INTERVAL '1 hour'),

  -- February 2025
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Ravi Shankar',    '9811000009', 'Karol Bagh',            'Ujala Cygnus Hospital', 'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  8,  2500, NOW() - INTERVAL '30 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Meera Pillai',    '9811000010', 'Laxmi Nagar',           'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  19, 1800, NOW() - INTERVAL '32 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Aditya Verma',    '9811000011', 'Mayur Vihar Phase 1',   'Ujala Cygnus Hospital', 'Scheduled', 'bbbbbbbb-0003-0000-0000-000000000003', 'Dinesh Verma', 'completed',  25, 1200, NOW() - INTERVAL '35 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Pooja Reddy',     '9811000012', 'Saket',                 'AIIMS Delhi',           'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  12, 2500, NOW() - INTERVAL '38 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Sanjay Kumar',    '9811000013', 'Dwarka Sector 7',       'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  17, 1800, NOW() - INTERVAL '40 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Nisha Malhotra',  '9811000014', 'Patel Nagar',           'Fortis Hospital',       'Scheduled', 'bbbbbbbb-0003-0000-0000-000000000003', 'Dinesh Verma', 'completed',  31, 1200, NOW() - INTERVAL '42 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Rohit Agarwal',   '9811000015', 'Connaught Place',       'Ujala Cygnus Hospital', 'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'cancelled',  NULL, 2500, NOW() - INTERVAL '45 days'),

  -- January 2025
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Geeta Sharma',    '9811000016', 'Uttam Nagar',           'Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  13, 1800, NOW() - INTERVAL '60 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Ashish Tiwari',   '9811000017', 'Rajouri Garden',        'AIIMS Delhi',           'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  10, 2500, NOW() - INTERVAL '62 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Divya Pandey',    '9811000018', 'Kalkaji',               'Ujala Cygnus Hospital', 'Scheduled', 'bbbbbbbb-0003-0000-0000-000000000003', 'Dinesh Verma', 'completed',  22, 1200, NOW() - INTERVAL '65 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Manoj Dubey',     '9811000019', 'Narela Industrial Area','Ujala Cygnus Hospital', 'Urgent',    'bbbbbbbb-0002-0000-0000-000000000002', 'Sunil Sharma', 'completed',  18, 1800, NOW() - INTERVAL '68 days'),
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Rekha Chauhan',   '9811000020', 'Shahadara',             'GTB Hospital',          'Critical',  'bbbbbbbb-0001-0000-0000-000000000001', 'Rajesh Kumar', 'completed',  7,  2500, NOW() - INTERVAL '70 days')
ON CONFLICT DO NOTHING;


-- 3 Demo Invoices
INSERT INTO public.invoices (id, hospital_id, period_label, total_rides, subtotal, gst, total, status, created_at)
VALUES
  (
    'cccccccc-0001-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'January 2026', 5, 9800.00, 1764.00, 11564.00, 'paid',
    NOW() - INTERVAL '55 days'
  ),
  (
    'cccccccc-0002-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'February 2026', 6, 11000.00, 1980.00, 12980.00, 'paid',
    NOW() - INTERVAL '25 days'
  ),
  (
    'cccccccc-0003-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'March 2026', 8, 16500.00, 2970.00, 19470.00, 'pending',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;


-- Invoice Items for January
INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount)
VALUES
  ('cccccccc-0001-0000-0000-000000000001', 'Critical — Geeta Sharma (Jan 24)',   1, 2500, 2500),
  ('cccccccc-0001-0000-0000-000000000001', 'Critical — Ashish Tiwari (Jan 22)',  1, 2500, 2500),
  ('cccccccc-0001-0000-0000-000000000001', 'Scheduled — Divya Pandey (Jan 19)',  1, 1200, 1200),
  ('cccccccc-0001-0000-0000-000000000001', 'Urgent — Manoj Dubey (Jan 16)',      1, 1800, 1800),
  ('cccccccc-0001-0000-0000-000000000001', 'Critical — Rekha Chauhan (Jan 14)',  1, 1800, 1800);

-- Invoice Items for February
INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount)
VALUES
  ('cccccccc-0002-0000-0000-000000000002', 'Critical — Ravi Shankar (Feb 23)',    1, 2500, 2500),
  ('cccccccc-0002-0000-0000-000000000002', 'Urgent — Meera Pillai (Feb 21)',      1, 1800, 1800),
  ('cccccccc-0002-0000-0000-000000000002', 'Scheduled — Aditya Verma (Feb 18)',   1, 1200, 1200),
  ('cccccccc-0002-0000-0000-000000000002', 'Critical — Pooja Reddy (Feb 15)',     1, 2500, 2500),
  ('cccccccc-0002-0000-0000-000000000002', 'Urgent — Sanjay Kumar (Feb 13)',      1, 1800, 1800),
  ('cccccccc-0002-0000-0000-000000000002', 'Scheduled — Nisha Malhotra (Feb 11)', 1, 1200, 1200);

-- Invoice Items for March
INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount)
VALUES
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Arjun Mehta (Mar 24)',     1, 2500, 2500),
  ('cccccccc-0003-0000-0000-000000000003', 'Urgent — Sunita Yadav (Mar 23)',      1, 1800, 1800),
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Vikram Singh (Mar 22)',    1, 2500, 2500),
  ('cccccccc-0003-0000-0000-000000000003', 'Scheduled — Priti Gupta (Mar 21)',    1, 1200, 1200),
  ('cccccccc-0003-0000-0000-000000000003', 'Urgent — Rahul Kapoor (Mar 20)',      1, 1800, 1800),
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Anita Bose (Mar 19)',      1, 1200, 1200);
