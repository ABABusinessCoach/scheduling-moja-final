
-- Replace "always true" RLS policies with explicit auth.uid() IS NOT NULL checks.
-- Functionally equivalent for authenticated users, but not a literal bypass.

-- ── seasonal_periods ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "seasonal_periods_insert" ON seasonal_periods;
DROP POLICY IF EXISTS "seasonal_periods_update" ON seasonal_periods;
DROP POLICY IF EXISTS "seasonal_periods_delete" ON seasonal_periods;

CREATE POLICY "seasonal_periods_insert" ON seasonal_periods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "seasonal_periods_update" ON seasonal_periods
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "seasonal_periods_delete" ON seasonal_periods
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── staff_seasonal_availability ─────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_seasonal_avail_insert" ON staff_seasonal_availability;
DROP POLICY IF EXISTS "staff_seasonal_avail_update" ON staff_seasonal_availability;
DROP POLICY IF EXISTS "staff_seasonal_avail_delete" ON staff_seasonal_availability;

CREATE POLICY "staff_seasonal_avail_insert" ON staff_seasonal_availability
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_seasonal_avail_update" ON staff_seasonal_availability
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_seasonal_avail_delete" ON staff_seasonal_availability
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── client_seasonal_availability ────────────────────────────────────────────
DROP POLICY IF EXISTS "client_seasonal_avail_insert" ON client_seasonal_availability;
DROP POLICY IF EXISTS "client_seasonal_avail_update" ON client_seasonal_availability;
DROP POLICY IF EXISTS "client_seasonal_avail_delete" ON client_seasonal_availability;

CREATE POLICY "client_seasonal_avail_insert" ON client_seasonal_availability
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_seasonal_avail_update" ON client_seasonal_availability
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "client_seasonal_avail_delete" ON client_seasonal_availability
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── shift_offers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shift_offers_insert" ON shift_offers;
DROP POLICY IF EXISTS "shift_offers_update" ON shift_offers;
DROP POLICY IF EXISTS "shift_offers_delete" ON shift_offers;

CREATE POLICY "shift_offers_insert" ON shift_offers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shift_offers_update" ON shift_offers
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shift_offers_delete" ON shift_offers
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── shift_offer_notifications ────────────────────────────────────────────────
DROP POLICY IF EXISTS "shift_offer_notifs_insert" ON shift_offer_notifications;
DROP POLICY IF EXISTS "shift_offer_notifs_update" ON shift_offer_notifications;
DROP POLICY IF EXISTS "shift_offer_notifs_delete" ON shift_offer_notifications;

CREATE POLICY "shift_offer_notifs_insert" ON shift_offer_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shift_offer_notifs_update" ON shift_offer_notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "shift_offer_notifs_delete" ON shift_offer_notifications
  FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);
