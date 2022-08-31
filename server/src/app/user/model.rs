use chrono::{DateTime, Utc};
use diesel::pg::PgConnection;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{error::AppError, hasher, schema::users, utils::token};

#[derive(Identifiable, Queryable, Serialize, Deserialize, Debug, Clone, Associations)]
#[table_name = "users"]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub hash: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

type Token = String;

impl User {
    pub fn signup<'a>(
        conn: &PgConnection,
        email: &'a str,
        username: &'a str,
        naive_password: &'a str,
    ) -> Result<(User, Token), AppError> {
        use diesel::prelude::*;
        let hashed_password = hasher::hash_password(naive_password)?;

        let record = SignupUser {
            email,
            hash: &hashed_password,
            name: username,
        };

        let user = diesel::insert_into(users::table)
            .values(&record)
            .get_result::<User>(conn)?;

        let token = user.generate_token()?;
        Ok((user, token))
    }

    pub fn signin(
        conn: &PgConnection,
        email: &str,
        naive_password: &str,
    ) -> Result<(User, Token), AppError> {
        let user = users::table
            .filter(users::email.eq(email))
            .limit(1)
            .first::<User>(conn)?;
        let password_matches = hasher::verify(&naive_password, &user.hash)?;

        if !password_matches {
            return Err(AppError::Unauthorized("Invalid password".into()));
        }

        let token = user.generate_token()?;
        Ok((user, token))
    }

    pub fn generate_token(&self) -> Result<Token, AppError> {
        let now = Utc::now().timestamp_nanos() / 1_000_000_000; // nanosecond -> second
        let token = token::generate(self.id, now)?;
        Ok(token)
    }

    pub fn find(conn: &PgConnection, id: Uuid) -> Result<Self, AppError> {
        let user = users::table.find(id).first(conn)?;
        Ok(user)
    }
}

#[derive(Insertable, Debug, Deserialize)]
#[table_name = "users"]
struct SignupUser<'a> {
    pub email: &'a str,
    pub hash: &'a str,
    pub name: &'a str,
}
