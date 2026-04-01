-- Smart ambulance assignment schema additions

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS assignment_score int,
  ADD COLUMN IF NOT EXISTS attempted_ambulance_ids text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS manually_overridden boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE TABLE IF NOT EXISTS public.assignment_attempts (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id     text NOT NULL,
  ambulance_id text NOT NULL,
  match_score int,
  attempt_number int DEFAULT 1,
  outcome     text, -- 'accepted' | 'declined' | 'timeout'
  response_time_seconds int,
  created_at  timestamptz DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_assignment_attempts_ride_id
  ON public.assignment_attempts (ride_id);
