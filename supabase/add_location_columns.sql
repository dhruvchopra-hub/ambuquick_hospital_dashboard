-- Add lat/lng/place_id columns to rides for Google Places Autocomplete data
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS pickup_place_id TEXT,
  ADD COLUMN IF NOT EXISTS destination_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS destination_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS destination_place_id TEXT;
