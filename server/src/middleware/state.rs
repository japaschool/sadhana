use crate::utils;
use common::error::AppError;
use diesel::pg::PgConnection;
use diesel::r2d2::{ConnectionManager, Pool, PooledConnection};

type PgConn = ConnectionManager<PgConnection>;

#[derive(Clone)]
pub struct AppState {
    pub pool: utils::db::DbPool,
}

impl AppState {
    pub fn get_conn(&self) -> Result<PooledConnection<PgConn>, AppError> {
        let conn = self.pool.get()?;
        Ok(conn)
    }

    pub fn init(pool: Pool<PgConn>) -> Self {
        AppState { pool }
    }
}
