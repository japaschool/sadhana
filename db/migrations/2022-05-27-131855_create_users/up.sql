create table users (
  email varchar(100) not null primary key,
  hash varchar(122) not null,
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

select diesel_manage_updated_at('users');