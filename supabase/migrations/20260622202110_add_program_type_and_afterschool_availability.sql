-- Add program_type to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS program_type text NOT NULL DEFAULT 'daytime'
    CHECK (program_type IN ('daytime', 'afterschool', 'both'));

-- Drop the unique constraint so a client can have both daytime and EVE rows for the same day
ALTER TABLE client_availability
  DROP CONSTRAINT IF EXISTS client_availability_client_id_day_of_week_key;

-- Expand shift check and day_of_week check to allow EVE/SAT shifts and Saturday
ALTER TABLE client_availability
  DROP CONSTRAINT IF EXISTS client_availability_shift_check,
  DROP CONSTRAINT IF EXISTS client_availability_day_of_week_check;

ALTER TABLE client_availability
  ADD CONSTRAINT client_availability_shift_check
    CHECK (shift IN ('AM', 'PM', 'FULL', 'EVE', 'SAT_AM', 'SAT_PM', 'SUM_HALF', 'SUM_FULL')),
  ADD CONSTRAINT client_availability_day_of_week_check
    CHECK (day_of_week BETWEEN 1 AND 6);

-- Add a partial unique index: one daytime row per (client_id, day_of_week) and one EVE row per (client_id, day_of_week)
-- We distinguish daytime (time_start < '15:00') from afterschool (time_start >= '15:00')
CREATE UNIQUE INDEX IF NOT EXISTS client_avail_daytime_unique
  ON client_availability (client_id, day_of_week)
  WHERE time_start < '15:00:00';

CREATE UNIQUE INDEX IF NOT EXISTS client_avail_evening_unique
  ON client_availability (client_id, day_of_week)
  WHERE time_start >= '15:00:00';
