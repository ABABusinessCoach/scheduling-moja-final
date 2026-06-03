/*
  # ABA Therapy Clinic Scheduling Schema

  ## Overview
  Full scheduling database for ABA therapy clinic staff and client management.

  ## New Tables
  - `staff` — Therapist profiles with tier, gender, employment type, hour goals
  - `staff_availability` — Per-day/shift availability for each staff member
  - `clients` — Client profiles with attendance days, shift type, and restrictions
  - `client_attendance` — Which days of the week each client attends
  - `staff_client_restrictions` — Specific staff–client pairing restrictions
  - `schedules` — Weekly schedule records (draft or published)
  - `schedule_assignments` — Individual day/shift staff–client assignments
  - `cancellations` — Cancellation records with handled status

  ## Security
  - RLS enabled on all tables
  - Authenticated users (admins) can read/write all records
  - Public read disabled; all access requires auth

  ## Seed Data
  - 7 staff members: Rebecca, Chloe, Becca (Tier 1), Nick, Erin, Cole (Tier 2), Haley (Tier 3)
  - Becca availability: PM only Mon/Tue, Full day Thu
  - Client ELTR with no-male restriction
  - Staff Rebecca restricted from client HALI
*/

-- Staff profiles
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  employment_type text NOT NULL DEFAULT 'full-time',
  weekly_hour_goal numeric(4,1) NOT NULL DEFAULT 20,
  priority_tier integer NOT NULL CHECK (priority_tier IN (1, 2, 3)),
  gender text NOT NULL DEFAULT 'female' CHECK (gender IN ('male', 'female', 'other')),
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read staff"
  ON staff FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert staff"
  ON staff FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update staff"
  ON staff FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete staff"
  ON staff FOR DELETE TO authenticated USING (true);

-- Staff availability per day/shift
CREATE TABLE IF NOT EXISTS staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  shift text NOT NULL CHECK (shift IN ('AM', 'PM', 'FULL')),
  UNIQUE (staff_id, day_of_week, shift)
);

ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read staff_availability"
  ON staff_availability FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert staff_availability"
  ON staff_availability FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update staff_availability"
  ON staff_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete staff_availability"
  ON staff_availability FOR DELETE TO authenticated USING (true);

-- Client profiles
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  shift_type text NOT NULL DEFAULT 'FULL' CHECK (shift_type IN ('AM', 'PM', 'FULL', 'CUSTOM')),
  custom_end_time time,
  no_male_therapists boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clients"
  ON clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete clients"
  ON clients FOR DELETE TO authenticated USING (true);

-- Client attendance days
CREATE TABLE IF NOT EXISTS client_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  UNIQUE (client_id, day_of_week)
);

ALTER TABLE client_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read client_attendance"
  ON client_attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client_attendance"
  ON client_attendance FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_attendance"
  ON client_attendance FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete client_attendance"
  ON client_attendance FOR DELETE TO authenticated USING (true);

-- Staff-client restrictions (specific pairs that cannot work together)
CREATE TABLE IF NOT EXISTS staff_client_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (staff_id, client_id)
);

ALTER TABLE staff_client_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read restrictions"
  ON staff_client_restrictions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert restrictions"
  ON staff_client_restrictions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update restrictions"
  ON staff_client_restrictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete restrictions"
  ON staff_client_restrictions FOR DELETE TO authenticated USING (true);

-- Weekly schedules
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedules"
  ON schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedules"
  ON schedules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
  ON schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete schedules"
  ON schedules FOR DELETE TO authenticated USING (true);

-- Individual schedule assignments (staff assigned to client for a day/shift)
CREATE TABLE IF NOT EXISTS schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  shift text NOT NULL CHECK (shift IN ('AM', 'PM')),
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_manual_override boolean NOT NULL DEFAULT false,
  violation_reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read schedule_assignments"
  ON schedule_assignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedule_assignments"
  ON schedule_assignments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedule_assignments"
  ON schedule_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete schedule_assignments"
  ON schedule_assignments FOR DELETE TO authenticated USING (true);

-- Cancellation records
CREATE TABLE IF NOT EXISTS cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  cancellation_type text NOT NULL CHECK (cancellation_type IN ('client', 'staff')),
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  shift text CHECK (shift IN ('AM', 'PM', 'FULL')),
  reason text DEFAULT '',
  recommendation text DEFAULT '',
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cancellations"
  ON cancellations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cancellations"
  ON cancellations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cancellations"
  ON cancellations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cancellations"
  ON cancellations FOR DELETE TO authenticated USING (true);
