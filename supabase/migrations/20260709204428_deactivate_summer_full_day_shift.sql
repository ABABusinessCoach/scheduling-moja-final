-- Deactivate SUMMER_FULL_DAY: it spans 8:00-15:30 and conflicts with the
-- two-session model (SUMMER_AM 8-12 + SUMMER_PM 12-15:30). 
-- Only SUMMER_AM and SUMMER_PM should be used for scheduling.
UPDATE shifts SET is_active = false WHERE name = 'SUMMER_FULL_DAY';
