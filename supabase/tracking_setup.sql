-- ============================================================
-- AmbuQuick: Patient Live Tracking — Supabase Setup
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add tracking columns to rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS tracking_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT FALSE;

-- 2. Backfill tracking tokens for any existing rides without one
UPDATE public.rides
SET tracking_token = gen_random_uuid()::TEXT
WHERE tracking_token IS NULL;

-- 3. Add slug and branding columns to hospitals
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#DC2626';

-- 4. Set slug for the seed Ujala Cygnus hospital
UPDATE public.hospitals
SET slug = 'ujala-cygnus', primary_color = '#DC2626'
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 5. RLS: Allow anonymous (public) users to read rides for tracking
--    tracking_token is a UUID — practically unguessable
DROP POLICY IF EXISTS "Public can read rides for tracking" ON public.rides;
CREATE POLICY "Public can read rides for tracking"
  ON public.rides FOR SELECT TO anon
  USING (tracking_token IS NOT NULL);

-- 6. RLS: Allow anonymous users to read ambulance location for tracking
DROP POLICY IF EXISTS "Public can read ambulance location" ON public.ambulances;
CREATE POLICY "Public can read ambulance location"
  ON public.ambulances FOR SELECT TO anon
  USING (true);

-- 7. RLS: Allow anonymous users to read hospital branding for tracking page
DROP POLICY IF EXISTS "Public can read hospital info" ON public.hospitals;
CREATE POLICY "Public can read hospital info"
  ON public.hospitals FOR SELECT TO anon
  USING (true);
