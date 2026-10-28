CREATE TABLE practice_groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_key int NOT NULL,
  is_default bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX practice_groups_one_default ON practice_groups (user_id) WHERE is_default;
CREATE UNIQUE INDEX practice_groups_unique_name ON practice_groups (user_id, name) WHERE NOT is_default;
ALTER TABLE user_practices ADD COLUMN group_id uuid NULL REFERENCES practice_groups(id) ON DELETE SET NULL;
SELECT diesel_manage_updated_at('practice_groups');
