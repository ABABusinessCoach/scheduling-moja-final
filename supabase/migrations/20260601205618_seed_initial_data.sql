/*
  # Seed Initial Data

  ## Staff Seed
  - Rebecca, Chloe, Becca (Tier 1, female)
  - Nick, Erin, Cole (Tier 2 — Nick and Cole are male, Erin is female)
  - Haley (Tier 3 floater, female)

  ## Availability Rules
  - Rebecca: full availability Mon–Fri
  - Chloe: full availability Mon–Fri
  - Becca: PM only Mon, PM only Tue, Full day Thu (no other days)
  - Nick: full availability Mon–Fri
  - Erin: full availability Mon–Fri
  - Cole: full availability Mon–Fri
  - Haley: full availability Mon–Fri (floater)

  ## Client Seed
  - ELTR — no male therapists restriction
  - HALI — no specific restriction yet (restriction to Rebecca handled via staff_client_restrictions)

  ## Restriction Seed
  - Client ELTR: no_male_therapists = true
  - Staff Rebecca cannot work with client HALI (family relationship)
*/

-- Seed staff (using DO block to avoid duplicate inserts)
DO $$
DECLARE
  rebecca_id uuid;
  chloe_id uuid;
  becca_id uuid;
  nick_id uuid;
  erin_id uuid;
  cole_id uuid;
  haley_id uuid;
  eltr_id uuid;
  hali_id uuid;
BEGIN
  -- Insert staff if they don't exist
  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Rebecca', 'full-time', 30, 1, 'female')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Chloe', 'full-time', 30, 1, 'female')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Becca', 'part-time', 20, 1, 'female')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Nick', 'full-time', 30, 2, 'male')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Erin', 'full-time', 30, 2, 'female')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Cole', 'full-time', 25, 2, 'male')
  ON CONFLICT DO NOTHING;

  INSERT INTO staff (name, employment_type, weekly_hour_goal, priority_tier, gender)
  VALUES ('Haley', 'part-time', 15, 3, 'female')
  ON CONFLICT DO NOTHING;

  -- Fetch IDs
  SELECT id INTO rebecca_id FROM staff WHERE name = 'Rebecca' LIMIT 1;
  SELECT id INTO chloe_id FROM staff WHERE name = 'Chloe' LIMIT 1;
  SELECT id INTO becca_id FROM staff WHERE name = 'Becca' LIMIT 1;
  SELECT id INTO nick_id FROM staff WHERE name = 'Nick' LIMIT 1;
  SELECT id INTO erin_id FROM staff WHERE name = 'Erin' LIMIT 1;
  SELECT id INTO cole_id FROM staff WHERE name = 'Cole' LIMIT 1;
  SELECT id INTO haley_id FROM staff WHERE name = 'Haley' LIMIT 1;

  -- Rebecca: full availability Mon–Fri
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT rebecca_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Chloe: full availability Mon–Fri
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT chloe_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Becca: PM only Mon (1), PM only Tue (2), Full Thu (4)
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  VALUES (becca_id, 1, 'PM'), (becca_id, 2, 'PM'), (becca_id, 4, 'FULL')
  ON CONFLICT DO NOTHING;

  -- Nick: full availability Mon–Fri
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT nick_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Erin: full availability Mon–Fri
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT erin_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Cole: full availability Mon–Fri
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT cole_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Haley: full availability Mon–Fri (floater)
  INSERT INTO staff_availability (staff_id, day_of_week, shift)
  SELECT haley_id, d, 'FULL' FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Seed clients: ELTR and HALI as starter clients
  INSERT INTO clients (first_name, last_name, shift_type, no_male_therapists)
  VALUES ('EL', 'TR', 'FULL', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO clients (first_name, last_name, shift_type, no_male_therapists)
  VALUES ('HA', 'LI', 'FULL', false)
  ON CONFLICT DO NOTHING;

  -- Fetch client IDs
  SELECT id INTO eltr_id FROM clients WHERE first_name = 'EL' AND last_name = 'TR' LIMIT 1;
  SELECT id INTO hali_id FROM clients WHERE first_name = 'HA' AND last_name = 'LI' LIMIT 1;

  -- Client ELTR attends Mon–Fri
  INSERT INTO client_attendance (client_id, day_of_week)
  SELECT eltr_id, d FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Client HALI attends Mon–Fri
  INSERT INTO client_attendance (client_id, day_of_week)
  SELECT hali_id, d FROM generate_series(1,5) d
  ON CONFLICT DO NOTHING;

  -- Restriction: Rebecca cannot work with HALI
  INSERT INTO staff_client_restrictions (staff_id, client_id, reason)
  VALUES (rebecca_id, hali_id, 'Family relationship')
  ON CONFLICT DO NOTHING;

END $$;
