alter table user_practices add column order_key int;

update user_practices up
set    order_key = rn - 1
from   (
    select id, 
           row_number() over(partition by user_id order by practice) as rn
    from   user_practices 
    ) s
where  s.id = up.id;

alter table user_practices alter column order_key set not null;
alter table user_practices add unique (user_id, order_key) deferrable initially deferred;