ALTER TYPE report_type_enum ADD VALUE 'panels';
ALTER TABLE reports ADD COLUMN definition jsonb;
