use chrono::{DateTime, Utc};
use diesel::{PgConnection, QueryDsl, Queryable, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::schema::users;
use errors::Error;

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
    pub fn get_all(conn: &PgConnection) -> Result<Vec<User>, Error> {
        use crate::schema::users::dsl::{name, users};

        Ok(users.order(name).load(conn)?)
    }

    pub fn create(conn: &PgConnection, new_user: NewUser) -> Result<User, Error> {
        use crate::schema::users::dsl::users;

        let user: User = diesel::insert_into(users)
            .values(new_user)
            .get_result(conn)?;
        Ok(user)
    }
}

#[derive(Debug, Insertable, Serialize)]
#[table_name = "users"]
pub struct NewUser {
    pub name: String,
    pub email: String,
    pub pwd_hash: String,
}
