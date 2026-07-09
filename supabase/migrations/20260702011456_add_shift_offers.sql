
CREATE TABLE shift_offers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID        REFERENCES schedules(id) ON DELETE CASCADE,
  assignment_id UUID      REFERENCES schedule_assignments(id) ON DELETE SET NULL,
  client_id   UUID        NOT NULL REFERENCES clients(id),
  day_of_week INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),
  time_start  TEXT        NOT NULL,
  time_end    TEXT        NOT NULL,
  shift_label TEXT        NOT NULL DEFAULT '',
  notes       TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'cancelled')),
  claimed_by_staff_id UUID REFERENCES staff(id),
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shift_offer_notifications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     UUID        NOT NULL REFERENCES shift_offers(id) ON DELETE CASCADE,
  staff_id     UUID        NOT NULL REFERENCES staff(id),
  accept_token TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  response     TEXT        CHECK (response IN ('accepted', 'declined')),
  UNIQUE (offer_id, staff_id)
);

ALTER TABLE shift_offers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_offer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_offers_select" ON shift_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_offers_insert" ON shift_offers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shift_offers_update" ON shift_offers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shift_offers_delete" ON shift_offers FOR DELETE TO authenticated USING (true);

CREATE POLICY "shift_offer_notifs_select" ON shift_offer_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_offer_notifs_insert" ON shift_offer_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "shift_offer_notifs_update" ON shift_offer_notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "shift_offer_notifs_delete" ON shift_offer_notifications FOR DELETE TO authenticated USING (true);
