
-- Add optional date range columns to shifts for seasonal scheduling
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS date_start date;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS date_end date;

-- Drop the existing check constraint on schedule_assignments.shift so we can expand it
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'schedule_assignments'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%shift%'
  LOOP
    EXECUTE 'ALTER TABLE public.schedule_assignments DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

ALTER TABLE schedule_assignments
  ADD CONSTRAINT schedule_assignments_shift_check
  CHECK (shift IN ('AM', 'PM', 'EVE', 'SAT_AM', 'SAT_PM', 'SUM_HALF', 'SUM_FULL'));

-- Insert the two summer shifts (Jul 13 – Aug 21 2026, weekdays only)
INSERT INTO shifts (name, label, time_start, time_end, days, color, sort_order, is_active, date_start, date_end)
VALUES
  ('SUM_HALF', 'Summer Half Day', '08:00:00', '12:00:00', ARRAY[1,2,3,4,5], '#0ea5e9', 10, true, '2026-07-13', '2026-08-21'),
  ('SUM_FULL', 'Summer Full Day', '08:00:00', '16:00:00', ARRAY[1,2,3,4,5], '#0284c7', 11, true, '2026-07-13', '2026-08-21')
ON CONFLICT DO NOTHING;
