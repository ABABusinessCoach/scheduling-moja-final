
ALTER TABLE time_off
  ADD COLUMN IF NOT EXISTS time_start TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS time_end   TEXT DEFAULT NULL;

COMMENT ON COLUMN time_off.time_start IS 'Optional HH:MM — when set, time off only covers part of the day (from this time)';
COMMENT ON COLUMN time_off.time_end   IS 'Optional HH:MM — when set, time off only covers part of the day (until this time)';
