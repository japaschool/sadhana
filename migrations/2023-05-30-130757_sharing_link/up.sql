create table shares (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references users,
    description text not null unique
);