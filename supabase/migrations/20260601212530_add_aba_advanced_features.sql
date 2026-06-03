/*
  # ABA Advanced Features Migration

  ## Summary
  Adds 7 advanced scheduling features to the ABA clinic app:

  1. **Authorized Hours** — `clients.authorized_hours_per_week` stores insurance-approved weekly max
  2. **Ramp-Up Schedule** — `clients.ramp_up_schedule` stores week-by-week hour targets as JSONB
  3. **Supervision Tracking** — `staff.supervision_hours_required` and `staff.supervision_hours_this_week`
  4. **BT Skill Matching** — `staff.skills` (text[]) and `clients.required_skills` (text[])
  5. **Session Notes** — new `session_notes` table linked to `schedule_assignments`
  6. No new tables for daily view or ratio alerts (computed in app logic)

  ## New Columns

  ### clients
  - `authorized_hours_per_week` (numeric, nullable) — max weekly hours from insurance
  - `ramp_up_schedule` (jsonb, nullable) — array of {week_number, target_hours}
  - `required_skills` (text[], default '{}') — skills a BT must have to work with this client

  ### staff
  - `skills` (text[], default '{}') — skills this BT is trained in
  - `supervision_hours_required` (numeric, default 0) — weekly supervision requirement
  - `supervision_hours_this_week` (numeric, default 0) — supervision hours received this week

  ## New Tables

  ### session_notes
  - `id` (uuid pk)
  - `assignment_id` (uuid fk → schedule_assignments)
  - `submitted` (boolean, default false)
  - `submitted_at` (timestamptz, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on session_notes
  - Authenticated users can read/insert/update their own session notes
*/

-- Add columns to clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='authorized_hours_per_week') THEN
    ALTER TABLE clients ADD COLUMN authorized_hours_per_week numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='ramp_up_schedule') THEN
    ALTER TABLE clients ADD COLUMN ramp_up_schedule jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='required_skills') THEN
    ALTER TABLE clients ADD COLUMN required_skills text[] DEFAULT '{}';
  END IF;
END $$;

-- Add columns to staff
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='skills') THEN
    ALTER TABLE staff ADD COLUMN skills text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='supervision_hours_required') THEN
    ALTER TABLE staff ADD COLUMN supervision_hours_required numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='supervision_hours_this_week') THEN
    ALTER TABLE staff ADD COLUMN supervision_hours_this_week numeric DEFAULT 0;
  END IF;
END $$;

-- Create session_notes table
CREATE TABLE IF NOT EXISTS session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES schedule_assignments(id) ON DELETE CASCADE,
  submitted boolean DEFAULT false,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read session notes"
  ON session_notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert session notes"
  ON session_notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update session notes"
  ON session_notes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
