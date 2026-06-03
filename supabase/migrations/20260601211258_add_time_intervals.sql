/*
  # Add Time Intervals to Staff Availability and Schedule Assignments

  ## Summary
  Adds precise start/end time columns to both staff_availability and schedule_assignments
  so the scheduler can match staff to sessions based on exact time windows rather than
  just AM/PM labels.

  ## Changes

  ### staff_availability
  - New column `time_start` (time) — when the staff member becomes available that day
  - New column `time_end` (time) — when the staff member is no longer available

  ### schedule_assignments
  - New column `time_start` (time) — actual session start time
  - New column `time_end` (time) — actual session end time

  ## Backfill
  Existing availability rows get times derived from their shift label:
  - AM  → 08:00 – 10:30
  - PM  → 10:30 – 14:30
  - FULL → 08:00 – 14:30

  Existing assignment rows get times from their shift:
  - AM → 08:00 – 10:30
  - PM → 10:30 – 14:30
*/

-- Add time columns to staff_availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_availability' AND column_name = 'time_start'
  ) THEN
    ALTER TABLE staff_availability ADD COLUMN time_start time;
    ALTER TABLE staff_availability ADD COLUMN time_end   time;
  END IF;
END $$;

-- Backfill existing staff_availability rows
UPDATE staff_availability
SET
  time_start = CASE shift
    WHEN 'AM'   THEN '08:00:00'::time
    WHEN 'PM'   THEN '10:30:00'::time
    WHEN 'FULL' THEN '08:00:00'::time
  END,
  time_end = CASE shift
    WHEN 'AM'   THEN '10:30:00'::time
    WHEN 'PM'   THEN '14:30:00'::time
    WHEN 'FULL' THEN '14:30:00'::time
  END
WHERE time_start IS NULL;

-- Add time columns to schedule_assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'schedule_assignments' AND column_name = 'time_start'
  ) THEN
    ALTER TABLE schedule_assignments ADD COLUMN time_start time;
    ALTER TABLE schedule_assignments ADD COLUMN time_end   time;
  END IF;
END $$;

-- Backfill existing assignment rows
UPDATE schedule_assignments
SET
  time_start = CASE shift
    WHEN 'AM' THEN '08:00:00'::time
    WHEN 'PM' THEN '10:30:00'::time
  END,
  time_end = CASE shift
    WHEN 'AM' THEN '10:30:00'::time
    WHEN 'PM' THEN '14:30:00'::time
  END
WHERE time_start IS NULL;
