create type practice_data_type_enum AS ENUM ('time', 'bool', 'int');

create table user_practices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users (id) not null,
  practice text not null,
  data_type practice_data_type_enum not null,
  valid_from date,
  valid_to date,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, practice)
);

create table diary (
  cob_date date not null,
  user_id uuid references users (id) not null,
  practice_id uuid references user_practices (id) not null,
  value jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (cob_date, user_id, practice_id)
);

select diesel_manage_updated_at('user_practices');
select diesel_manage_updated_at('diary');