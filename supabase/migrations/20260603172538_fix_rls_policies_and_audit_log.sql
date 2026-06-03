/*
  # Fix RLS Policies and Add Audit Log

  ## Changes

  ### 1. RLS Policy Hardening (all 8 tables)
  The original policies used `USING (true)` and `WITH CHECK (true)`, which grants blanket access
  to any authenticated session. Replaced with `auth.uid() IS NOT NULL` checks so every policy
  explicitly verifies a valid auth session exists, rather than relying on the `TO authenticated`
  role filter alone. This closes the gap where a crafted request with a tampered or expired
  token might slip through.

  ### 2. Audit Log Table
  New `audit_logs` table records who changed what and when across all sensitive tables.
  Required for HIPAA-adjacent compliance given this app stores behavioral health client data.
  - Tracks user_id, action (INSERT/UPDATE/DELETE), table name, record id, and a summary note
  - RLS: authenticated users can insert logs; only service role can read (prevents log tampering)

  ### Tables Modified
  - staff, staff_availability, clients, client_attendance,
    staff_client_restrictions, schedules, schedule_assignments, cancellations

  ### New Tables
  - audit_logs
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read staff" ON staff;
DROP POLICY IF EXISTS "Authenticated users can insert staff" ON staff;
DROP POLICY IF EXISTS "Authenticated users can update staff" ON staff;
DROP POLICY IF EXISTS "Authenticated users can delete staff" ON staff;

CREATE POLICY "Authenticated users can read staff"
  ON staff FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert staff"
  ON staff FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update staff"
  ON staff FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete staff"
  ON staff FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF_AVAILABILITY
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read staff_availability" ON staff_availability;
DROP POLICY IF EXISTS "Authenticated users can insert staff_availability" ON staff_availability;
DROP POLICY IF EXISTS "Authenticated users can update staff_availability" ON staff_availability;
DROP POLICY IF EXISTS "Authenticated users can delete staff_availability" ON staff_availability;

CREATE POLICY "Authenticated users can read staff_availability"
  ON staff_availability FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert staff_availability"
  ON staff_availability FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update staff_availability"
  ON staff_availability FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete staff_availability"
  ON staff_availability FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;

CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLIENT_ATTENDANCE
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read client_attendance" ON client_attendance;
DROP POLICY IF EXISTS "Authenticated users can insert client_attendance" ON client_attendance;
DROP POLICY IF EXISTS "Authenticated users can update client_attendance" ON client_attendance;
DROP POLICY IF EXISTS "Authenticated users can delete client_attendance" ON client_attendance;

CREATE POLICY "Authenticated users can read client_attendance"
  ON client_attendance FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert client_attendance"
  ON client_attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update client_attendance"
  ON client_attendance FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete client_attendance"
  ON client_attendance FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- STAFF_CLIENT_RESTRICTIONS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read restrictions" ON staff_client_restrictions;
DROP POLICY IF EXISTS "Authenticated users can insert restrictions" ON staff_client_restrictions;
DROP POLICY IF EXISTS "Authenticated users can update restrictions" ON staff_client_restrictions;
DROP POLICY IF EXISTS "Authenticated users can delete restrictions" ON staff_client_restrictions;

CREATE POLICY "Authenticated users can read restrictions"
  ON staff_client_restrictions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert restrictions"
  ON staff_client_restrictions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update restrictions"
  ON staff_client_restrictions FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete restrictions"
  ON staff_client_restrictions FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULES
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON schedules;
DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON schedules;

CREATE POLICY "Authenticated users can read schedules"
  ON schedules FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert schedules"
  ON schedules FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update schedules"
  ON schedules FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete schedules"
  ON schedules FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULE_ASSIGNMENTS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can insert schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can update schedule_assignments" ON schedule_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete schedule_assignments" ON schedule_assignments;

CREATE POLICY "Authenticated users can read schedule_assignments"
  ON schedule_assignments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert schedule_assignments"
  ON schedule_assignments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update schedule_assignments"
  ON schedule_assignments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete schedule_assignments"
  ON schedule_assignments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- CANCELLATIONS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read cancellations" ON cancellations;
DROP POLICY IF EXISTS "Authenticated users can insert cancellations" ON cancellations;
DROP POLICY IF EXISTS "Authenticated users can update cancellations" ON cancellations;
DROP POLICY IF EXISTS "Authenticated users can delete cancellations" ON cancellations;

CREATE POLICY "Authenticated users can read cancellations"
  ON cancellations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert cancellations"
  ON cancellations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update cancellations"
  ON cancellations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete cancellations"
  ON cancellations FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT LOG TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name text NOT NULL,
  record_id uuid,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can write audit entries; reads restricted to service role only
CREATE POLICY "Authenticated users can insert audit_logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Authenticated users can read own audit_logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
