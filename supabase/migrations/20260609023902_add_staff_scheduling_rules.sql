ALTER TABLE staff ADD COLUMN IF NOT EXISTS scheduling_rules text[] NOT NULL DEFAULT '{}';

-- Insert the Clinic Closed break (14:30–15:00, weekdays) if no break_times exist yet
-- or if this specific break doesn't exist
INSERT INTO break_times (name, time_start, time_end, days, is_active, sort_order)
SELECT 'Clinic Closed', '14:30', '15:00', ARRAY[1,2,3,4,5], true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM break_times WHERE name = 'Clinic Closed'
);
