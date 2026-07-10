
-- Expand priority_tier to allow tier 4 (last-resort staff)
ALTER TABLE staff DROP CONSTRAINT staff_priority_tier_check;
ALTER TABLE staff ADD CONSTRAINT staff_priority_tier_check CHECK (priority_tier BETWEEN 1 AND 4);

-- Set Sami Stewart to tier 4 (last resort — interim admin)
UPDATE staff
SET priority_tier = 4,
    scheduling_rules = ARRAY['Interim admin — schedule only as absolute last resort']
WHERE name = 'Sami Stewart';
