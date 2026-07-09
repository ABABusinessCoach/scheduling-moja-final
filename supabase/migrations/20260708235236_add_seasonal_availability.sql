
CREATE TABLE seasonal_periods (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  period_type  TEXT        NOT NULL DEFAULT 'custom'
                           CHECK (period_type IN ('summer', 'winter_break', 'spring_break', 'custom')),
  date_start   DATE        NOT NULL,
  date_end     DATE        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (date_end >= date_start)
);

CREATE TABLE staff_seasonal_availability (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period_id    UUID        NOT NULL REFERENCES seasonal_periods(id) ON DELETE CASCADE,
  day_of_week  INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  time_start   TEXT        NOT NULL,
  time_end     TEXT        NOT NULL,
  is_available BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (staff_id, period_id, day_of_week)
);

CREATE TABLE client_seasonal_availability (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_id    UUID        NOT NULL REFERENCES seasonal_periods(id) ON DELETE CASCADE,
  day_of_week  INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  time_start   TEXT        NOT NULL,
  time_end     TEXT        NOT NULL,
  is_available BOOLEAN     NOT NULL DEFAULT true,
  UNIQUE (client_id, period_id, day_of_week)
);

-- RLS
ALTER TABLE seasonal_periods             ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_seasonal_availability  ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_seasonal_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_periods_select" ON seasonal_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "seasonal_periods_insert" ON seasonal_periods FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "seasonal_periods_update" ON seasonal_periods FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "seasonal_periods_delete" ON seasonal_periods FOR DELETE TO authenticated USING (true);

CREATE POLICY "staff_seasonal_avail_select" ON staff_seasonal_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff_seasonal_avail_insert" ON staff_seasonal_availability FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff_seasonal_avail_update" ON staff_seasonal_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff_seasonal_avail_delete" ON staff_seasonal_availability FOR DELETE TO authenticated USING (true);

CREATE POLICY "client_seasonal_avail_select" ON client_seasonal_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_seasonal_avail_insert" ON client_seasonal_availability FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_seasonal_avail_update" ON client_seasonal_availability FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_seasonal_avail_delete" ON client_seasonal_availability FOR DELETE TO authenticated USING (true);

-- Seed common periods
INSERT INTO seasonal_periods (name, period_type, date_start, date_end) VALUES
  ('Summer 2026',         'summer',       '2026-07-13', '2026-08-21'),
  ('Winter Break 2026-27','winter_break', '2026-12-22', '2027-01-02'),
  ('Spring Break 2027',   'spring_break', '2027-03-29', '2027-04-04'),
  ('Summer 2027',         'summer',       '2027-07-05', '2027-08-20');
