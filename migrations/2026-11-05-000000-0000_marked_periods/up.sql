CREATE TABLE marked_periods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  start_date date NOT NULL,
  end_date date NULL CHECK (end_date IS NULL OR end_date >= start_date),
  exclude_from_usual bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marked_periods_user_id ON marked_periods(user_id);
SELECT diesel_manage_updated_at('marked_periods');
