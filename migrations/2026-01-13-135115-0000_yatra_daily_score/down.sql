alter table yatra_practices drop column daily_score;

alter table yatras drop column show_stability_metrics;

drop function if exists normalize_value;
