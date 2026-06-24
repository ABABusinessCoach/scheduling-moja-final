
-- Add start_date to staff and clients
ALTER TABLE staff ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS start_date date;

-- Time off table: covers both staff and client absences on specific date ranges
CREATE TABLE IF NOT EXISTS time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES staff(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_end date NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_off_one_person CHECK (
    (staff_id IS NOT NULL AND client_id IS NULL) OR
    (staff_id IS NULL AND client_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS time_off_staff_idx ON time_off(staff_id);
CREATE INDEX IF NOT EXISTS time_off_client_idx ON time_off(client_id);
CREATE INDEX IF NOT EXISTS time_off_dates_idx ON time_off(date_start, date_end);

ALTER TABLE time_off ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_time_off" ON time_off FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_time_off" ON time_off FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_time_off" ON time_off FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_time_off" ON time_off FOR DELETE
  TO authenticated USING (true);
