ALTER TABLE users ADD COLUMN legacy_share_enabled bool NOT NULL DEFAULT false;
UPDATE users SET legacy_share_enabled = true;

CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  start_date date NULL,
  last_opened_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX share_links_user_id ON share_links(user_id);
SELECT diesel_manage_updated_at('share_links');

CREATE TABLE share_link_reports (
  share_link_id uuid NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  PRIMARY KEY (share_link_id, report_id)
);
CREATE INDEX share_link_reports_report_id ON share_link_reports(report_id);
