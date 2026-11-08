-- New accounts start with the old public link off; existing accounts keep what they have.
ALTER TABLE users ALTER COLUMN legacy_share_enabled SET DEFAULT false;
