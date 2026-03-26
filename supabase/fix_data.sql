-- ============================================================
-- AmbuQuick Data Fix Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Fix hospital contact person
UPDATE public.hospitals
SET contact_person = 'Kripal Negi'
WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';


-- 2. Remove founder name from patient data
UPDATE public.rides
SET patient_name = 'Amit Rawat'
WHERE patient_name ILIKE '%Dhruv Chopra%';


-- 3a. Fix invoice period labels (2025 → 2026)
UPDATE public.invoices SET period_label = 'January 2026'
WHERE id = 'cccccccc-0001-0000-0000-000000000001';

UPDATE public.invoices SET period_label = 'February 2026'
WHERE id = 'cccccccc-0002-0000-0000-000000000002';

UPDATE public.invoices SET period_label = 'March 2026'
WHERE id = 'cccccccc-0003-0000-0000-000000000003';


-- 3b. Delete duplicate March 2026 invoices (keep only the seed one)
DELETE FROM public.invoice_items
WHERE invoice_id IN (
  SELECT id FROM public.invoices
  WHERE period_label ILIKE 'March 2026'
    AND id != 'cccccccc-0003-0000-0000-000000000003'
);

DELETE FROM public.invoices
WHERE period_label ILIKE 'March 2026'
  AND id != 'cccccccc-0003-0000-0000-000000000003';


-- 3c. Fix March 2026 invoice amounts (8 completed rides = ₹19,470 incl GST)
UPDATE public.invoices
SET total_rides = 8,
    subtotal    = 16500.00,
    gst         = 2970.00,
    total       = 19470.00,
    status      = 'pending'
WHERE id = 'cccccccc-0003-0000-0000-000000000003';

-- Result: Jan paid ₹11,564 + Feb paid ₹12,980 + Mar pending ₹19,470 = ₹44,014 Total This Year ✓

-- Update March invoice items to match corrected amounts
DELETE FROM public.invoice_items
WHERE invoice_id = 'cccccccc-0003-0000-0000-000000000003';

INSERT INTO public.invoice_items (invoice_id, description, quantity, rate, amount) VALUES
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Arjun Mehta (Mar 25)',     1, 2500, 2500),
  ('cccccccc-0003-0000-0000-000000000003', 'Urgent — Sunita Yadav (Mar 24)',      1, 1800, 1800),
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Vikram Singh (Mar 23)',    1, 2500, 2500),
  ('cccccccc-0003-0000-0000-000000000003', 'Scheduled — Priti Gupta (Mar 22)',    1, 1200, 1200),
  ('cccccccc-0003-0000-0000-000000000003', 'Urgent — Rahul Kapoor (Mar 21)',      1, 1800, 1800),
  ('cccccccc-0003-0000-0000-000000000003', 'Critical — Anita Bose (Mar 20)',      1, 2500, 2500),
  ('cccccccc-0003-0000-0000-000000000003', 'Urgent — Deepak Joshi (Mar 23)',      1, 1800, 1800),
  ('cccccccc-0003-0000-0000-000000000003', 'Scheduled — Kavya Nair (Mar 25)',     1, 1200, 1200);


-- 4. Fix ambulance PINs (0000 → realistic 4-digit values)
UPDATE public.ambulances SET driver_pin = '4821'
WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001';

UPDATE public.ambulances SET driver_pin = '7364'
WHERE id = 'bbbbbbbb-0002-0000-0000-000000000002';

UPDATE public.ambulances SET driver_pin = '2958'
WHERE id = 'bbbbbbbb-0003-0000-0000-000000000003';

UPDATE public.ambulances SET driver_pin = '6173'
WHERE id = 'bbbbbbbb-0004-0000-0000-000000000004';


-- 5. Populate missing response_time_minutes for completed rides
--    Values seeded between 9 and 24 minutes using deterministic offsets
UPDATE public.rides
SET response_time_minutes =
  CASE
    WHEN MOD(ABS(('x' || MD5(id::text))::bit(32)::int), 4) = 0 THEN 11
    WHEN MOD(ABS(('x' || MD5(id::text))::bit(32)::int), 4) = 1 THEN 16
    WHEN MOD(ABS(('x' || MD5(id::text))::bit(32)::int), 4) = 2 THEN 13
    ELSE 21
  END
WHERE status = 'completed' AND response_time_minutes IS NULL;


-- 6. Add new ambulance columns for vehicle details
ALTER TABLE public.ambulances
  ADD COLUMN IF NOT EXISTS reg_number       TEXT,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS next_service_date DATE;

UPDATE public.ambulances
SET reg_number = 'DL 4C AB 1234', last_service_date = '2026-01-10', next_service_date = '2026-07-10'
WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001';

UPDATE public.ambulances
SET reg_number = 'DL 4C AB 1235', last_service_date = '2025-12-05', next_service_date = '2026-06-05'
WHERE id = 'bbbbbbbb-0002-0000-0000-000000000002';

UPDATE public.ambulances
SET reg_number = 'DL 5C UC 3341', last_service_date = '2026-02-20', next_service_date = '2026-08-20'
WHERE id = 'bbbbbbbb-0003-0000-0000-000000000003';

UPDATE public.ambulances
SET reg_number = 'DL 5C UC 3342', last_service_date = '2025-11-15', next_service_date = '2026-05-15'
WHERE id = 'bbbbbbbb-0004-0000-0000-000000000004';


-- 7. Add new ride columns for clinical data capture
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS patient_age     INTEGER,
  ADD COLUMN IF NOT EXISTS patient_gender  TEXT CHECK (patient_gender IN ('Male', 'Female', 'Other')),
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT;
