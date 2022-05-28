// Enables use of macros from diesel crate everywhere in this crate
#[macro_use]
extern crate diesel;

use std::env;

use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};

pub mod models;
pub mod schema;

pub type PgPool = Pool<ConnectionManager<PgConnection>>;

pub fn get_conn(pool: &PgPool) -> PooledConnection<ConnectionManager<PgConnection>> {
    pool.get().unwrap()
}

pub fn new_pool() -> PgPool {
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<PgConnection>::new(database_url);

    Pool::builder()
        .build(manager)
        .expect("failed to create db pool")
}
