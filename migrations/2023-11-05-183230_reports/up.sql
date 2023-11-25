create type report_type_enum AS ENUM ('graph', 'grid');

create type trace_type_enum AS ENUM ('bar', 'line', 'dot');

create type line_style_enum AS ENUM ('regular', 'square');

create type bar_layout_enum AS ENUM ('grouped', 'overlaid', 'stacked');

create table reports (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references users (id) not null,
    report_type report_type_enum not null,
    name text not null,
    bar_layout bar_layout_enum,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    unique (user_id, name)
);

create table report_traces (
    id uuid primary key default uuid_generate_v4(),
    report_id uuid references reports (id) not null,
    practice_id uuid references user_practices (id) not null,
    trace_type trace_type_enum,
    label text,
    y_axis text,
    show_average boolean,
    line_style line_style_enum
);

select
    diesel_manage_updated_at('reports');