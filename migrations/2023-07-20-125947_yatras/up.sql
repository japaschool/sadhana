create table yatras (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table yatra_practices (
  id uuid primary key default uuid_generate_v4(),
  yatra_id uuid not null references yatras (id),
  practice text not null,
  data_type practice_data_type_enum not null,
  order_key int not null,
  unique (yatra_id, practice)
);

create table yatra_users (
  yatra_id uuid not null references yatras (id),
  user_id uuid not null references users (id),
  is_admin boolean default false not null,
  primary key (yatra_id, user_id)
);

create table yatra_user_practices (
  yatra_practice_id uuid references yatra_practices (id),
  user_practice_id uuid references user_practices (id),
  primary key (yatra_practice_id, user_practice_id)
);

select
  diesel_manage_updated_at('yatras');