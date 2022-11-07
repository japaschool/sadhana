create extension if not exists "uuid-ossp";

create table users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  hash text not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

select diesel_manage_updated_at('users');