-- 'Йога' is spelled identically in Ukrainian and Russian, but `practice` is the
-- sole primary key so only one row per text can exist.  EN and UK users get the
-- default; a proper schema fix (composite PK) can address RU in a future migration.
insert into default_user_practices (practice, data_type, order_key, lang)
values
    ('Yoga', 'duration', 6, 'en'),
    ('Йога', 'duration', 6, 'uk')
on conflict (practice) do nothing;
