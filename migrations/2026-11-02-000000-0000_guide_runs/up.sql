CREATE TABLE guide_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_from varchar(16) NOT NULL CHECK (started_from IN ('signup', 'add_practice')),
  outcome varchar(16) NULL CHECK (outcome IN ('finished', 'left')),
  last_step varchar(32) NULL,
  has_reader bool NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
SELECT diesel_manage_updated_at('guide_runs');
