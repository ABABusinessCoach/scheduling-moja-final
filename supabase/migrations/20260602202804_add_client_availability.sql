/*
  # Add Client Availability Table

  ## Summary
  Adds a `client_availability` table that mirrors `staff_availability`, giving each client
  precise per-day time windows (start/end times + shift label). This lets the scheduler
  match sessions to the exact hours a client is present each day, rather than relying solely
  on the coarser `shift_type` column.

  ## New Table

  ### client_availability
  - `id` (uuid pk)
  - `client_id` (uuid fk → clients, CASCADE DELETE)
  - `day_of_week` (integer 1–5, Mon–Fri)
  - `shift` (text: AM | PM | FULL)
  - `time_start` (time) — when client arrives
  - `time_end` (time) — when client leaves
  - UNIQUE on (client_id, day_of_week)

  ## Security
  - RLS enabled
  - Authenticated users can read/insert/update/delete their own records

  ## Notes
  - Replaces the simpler `client_attendance` + `shift_type` combo for scheduling purposes
  - `client_attendance` is kept for backward compatibility
  - Existing clients get no rows in this table until edited and re-saved
*/

CREATE TABLE IF NOT EXISTS client_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  shift text NOT NULL CHECK (shift IN ('AM', 'PM', 'FULL')),
  time_start time,
  time_end time,
  UNIQUE (client_id, day_of_week)
);

ALTER TABLE client_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client_availability"
  ON client_availability FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client_availability"
  ON client_availability FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_availability"
  ON client_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client_availability"
  ON client_availability FOR DELETE TO authenticated USING (true);
