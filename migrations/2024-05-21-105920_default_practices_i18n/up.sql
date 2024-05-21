drop trigger if exists set_updated_at on default_user_practices;

alter table default_user_practices add column lang text;

update default_user_practices set lang = 'ru';

alter table default_user_practices alter column lang set not null;

insert into default_user_practices(practice, data_type, order_key, lang)
values 
    ('Wake up time', 'time', 0, 'en'), 
    ('Go to sleep time', 'time', 1, 'en'),
    ('Rounds by 7am', 'int', 2, 'en'), 
    ('Total Rounds', 'int', 3, 'en'), 
    ('Час ранкового підйому', 'time', 0, 'uk'), 
    ('Час відходу до сну', 'time', 1, 'uk'), 
    ('Кругів до 7 ранку', 'int', 2, 'uk'), 
    ('Кругів за день', 'int', 3, 'uk');