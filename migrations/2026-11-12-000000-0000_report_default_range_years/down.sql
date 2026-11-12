UPDATE reports SET default_range = 'all' WHERE default_range IN ('2y', '3y', '5y');
ALTER TABLE reports DROP CONSTRAINT reports_default_range_check;
ALTER TABLE reports ADD CONSTRAINT reports_default_range_check
  CHECK (default_range IN ('7d', '30d', '90d', '1y', 'all'));
