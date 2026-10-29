ALTER TABLE reports ADD COLUMN group_columns bool NOT NULL DEFAULT true;
ALTER TABLE report_traces ADD COLUMN order_key int NOT NULL DEFAULT 0;
