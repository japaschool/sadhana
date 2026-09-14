insert into default_user_practices (practice, data_type, order_key, lang)
values
    ('Reading', 'bool', 4, 'en'),
    ('Meditation', 'duration', 5, 'en'),
    ('Читання', 'bool', 4, 'uk'),
    ('Медитація', 'duration', 5, 'uk'),
    ('Чтение', 'bool', 4, 'ru'),
    ('Медитация', 'duration', 5, 'ru')
on conflict (practice) do nothing;
