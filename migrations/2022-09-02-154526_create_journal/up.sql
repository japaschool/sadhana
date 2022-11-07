create table user_metrics (
  user_id uuid references users (id) not null,
  metric text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, metric)
);

create table journal (
  cob_date date not null,
  user_id uuid not null,
  metric text not null,
  value json,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (cob_date, user_id, metric),
  foreign key (user_id, metric) references user_metrics (user_id, metric)
);

select diesel_manage_updated_at('user_metrics');
select diesel_manage_updated_at('journal');