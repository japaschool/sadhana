create table users (
  id serial primary key,
  name text not null,
  email text not null,
  pwd_hash text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

select diesel_manage_updated_at('users');