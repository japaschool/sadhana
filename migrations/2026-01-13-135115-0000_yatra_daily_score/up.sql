alter table yatra_practices add column daily_score_config jsonb;

create or replace function normalize_value(
    data_type practice_data_type_enum,
    value jsonb
)
returns numeric
language sql
immutable
strict
as $$
    select case data_type
        when 'int' then (value->>'Int')::numeric
        when 'duration' then (value->>'Duration')::numeric
        when 'time' then
            (value->'Time'->>'h')::numeric * 60
            + (value->'Time'->>'m')::numeric
        else null
    end
$$;