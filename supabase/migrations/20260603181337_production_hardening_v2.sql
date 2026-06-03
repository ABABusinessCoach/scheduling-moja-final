/*
  # Production Hardening: Indexes, Policy Cleanup, Triggers

  1. Drop old USING(true) session_notes policies
  2. Add indexes on all FK and high-frequency query columns
  3. updated_at trigger function + triggers (CREATE OR REPLACE pattern)
  4. Fix audit_logs SELECT to own records only
  5. Cancellations integrity CHECK constraint
*/

-- 1. Drop old permissive session_notes policies
DROP POLICY IF EXISTS "Authenticated users can read session notes" ON session_notes;
DROP POLICY IF EXISTS "Authenticated users can insert session notes" ON session_notes;
DROP POLICY IF EXISTS "Authenticated users can update session notes" ON session_notes;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_client_attendance_client_id ON client_attendance(client_id);
CREATE INDEX IF NOT EXISTS idx_client_availability_client_id ON client_availability(client_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_restrictions_staff_id ON staff_client_restrictions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_client_restrictions_client_id ON staff_client_restrictions(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_schedule_id ON schedule_assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_staff_id ON schedule_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_client_id ON schedule_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_schedule_assignments_day_shift ON schedule_assignments(day_of_week, shift);
CREATE INDEX IF NOT EXISTS idx_cancellations_schedule_id ON cancellations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_assignment_id ON session_notes(assignment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 3. updated_at trigger (safe: DROP IF EXISTS before CREATE)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_schedules_updated_at ON schedules;
CREATE TRIGGER trg_schedules_updated_at
  BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Fix audit_logs SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read own audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can read own audit_logs" ON audit_logs;

CREATE POLICY "Users can read own audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. Cancellations integrity constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'cancellations' AND constraint_name = 'cancellations_requires_entity'
  ) THEN
    ALTER TABLE cancellations
      ADD CONSTRAINT cancellations_requires_entity
      CHECK (staff_id IS NOT NULL OR client_id IS NOT NULL);
  END IF;
END $$;
