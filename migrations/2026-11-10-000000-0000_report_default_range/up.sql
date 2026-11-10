-- The range a report opens on; null is the app's default (30d).
ALTER TABLE reports ADD COLUMN default_range TEXT
  CHECK (default_range IN ('7d', '30d', '90d', '1y', 'all'));
