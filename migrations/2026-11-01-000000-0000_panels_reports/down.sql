DELETE FROM reports WHERE report_type = 'panels';
ALTER TABLE reports DROP COLUMN definition;
ALTER TYPE report_type_enum RENAME TO report_type_enum_old;
CREATE TYPE report_type_enum AS ENUM ('graph', 'grid');
ALTER TABLE reports ALTER COLUMN report_type TYPE report_type_enum USING report_type::text::report_type_enum;
DROP TYPE report_type_enum_old;
