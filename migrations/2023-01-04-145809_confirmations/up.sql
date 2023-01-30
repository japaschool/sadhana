create table confirmations (
  id uuid primary key default uuid_generate_v4(),
  email varchar(50) not null unique,
  expires_at timestamp not null
);

CREATE FUNCTION confirmations_delete_old_rows() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM confirmations WHERE expires_at < NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER confirmations_delete_old_rows_trigger
    AFTER INSERT ON confirmations
    EXECUTE PROCEDURE confirmations_delete_old_rows();