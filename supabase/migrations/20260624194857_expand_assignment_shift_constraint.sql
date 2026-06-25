
-- Drop the hardcoded shift name constraint so dynamic shifts from the shifts table can be used
ALTER TABLE schedule_assignments
  DROP CONSTRAINT IF EXISTS schedule_assignments_shift_check;
