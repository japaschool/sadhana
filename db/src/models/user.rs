use chrono::{DateTime, Utc};
use diesel::{PgConnection, QueryDsl, Queryable, RunQueryDsl};
use serde_derive::{Deserialize, Serialize};

use crate::schema::users;

#[derive(Debug, Identifiable, Serialize, Deserialize, Queryable)]
pub struct User {
    pub id: i32,
    pub name: String,
    pub email: String,
    pub pwd_hash: String, //FIXME: ensure this field is not returned to the UI
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    pub fn get_all(conn: &PgConnection) -> Result<Vec<User>, diesel::result::Error> {
        use crate::schema::users::dsl::{name, users};

        users.order(name).load(conn)
    }
}
