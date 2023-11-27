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

select diesel_manage_updated_at('reports');

insert into reports (user_id, report_type, name, bar_layout)
select up.user_id,
    case
        when up.data_type in ('text', 'bool') then 'grid'::report_type_enum
        else 'graph'
    end,
    up.practice,
    case
        when up.data_type not in ('text', 'bool') then 'grouped'::bar_layout_enum
    end
from user_practices up
where trim(up.practice) != ''
    and up.is_active = true;

insert into report_traces (report_id, practice_id, trace_type, show_average)
select r.id,
    up.id,
    case
        when r.report_type = 'graph' then 'bar'::trace_type_enum
        else null
    end,
    case
        when r.report_type = 'graph' then true
        else null
    end
from user_practices up
    join reports r on r.name = up.practice
    and r.user_id = up.user_id;