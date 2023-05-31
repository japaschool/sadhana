delete from default_user_practices;

alter table default_user_practices add column order_key int;

insert into default_user_practices (practice, data_type, order_key)
values ('Время утреннего подъема', 'time', 0), 
    ('Время отхода ко сну', 'time', 1), 
    ('Кругов до 7 утра', 'int', 2), 
    ('Кругов за день', 'int', 3);