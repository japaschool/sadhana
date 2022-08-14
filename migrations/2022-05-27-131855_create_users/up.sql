create extension if not exists "uuid-ossp";

create table users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email varchar(100) not null unique,
  hash varchar(122) not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

select diesel_manage_updated_at('users');