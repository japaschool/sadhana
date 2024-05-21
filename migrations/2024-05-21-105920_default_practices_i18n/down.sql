delete from default_user_practices where lang != 'ru';
alter table default_user_practices drop column lang;
