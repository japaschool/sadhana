use crate::{
    hasher,
    schema::{confirmations, users},
    utils::token,
};
use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use common::error::AppError;
use diesel::{
    pg::PgConnection, prelude::*, sql_query, sql_types::Uuid as DieselUuid, upsert::excluded,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Identifiable, Queryable, Serialize, Deserialize, Debug, Clone)]
#[diesel(table_name = users)]
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
        conn: &mut PgConnection,
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

        conn.transaction(|conn| {
            sql_query(
                r#"
            insert into user_practices (user_id, practice, data_type, is_active, order_key)
                select $1, practice, data_type, true, order_key
                from default_user_practices
            "#,
            )
            .bind::<DieselUuid, _>(&user.id)
            .execute(conn)?;

            // Cleanup confirmations
            diesel::delete(confirmations::table)
                .filter(confirmations::email.eq(&email))
                .execute(conn)
        })?;

        Ok((user, token))
    }

    pub fn signin(
        conn: &mut PgConnection,
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

    pub fn find(conn: &mut PgConnection, id: &Uuid) -> Result<Self, AppError> {
        let user = users::table.find(id).first(conn)?;
        Ok(user)
    }

    pub fn update(conn: &mut PgConnection, id: Uuid, name: &str) -> Result<(), AppError> {
        diesel::update(users::table)
            .filter(users::id.eq(id))
            .set(users::name.eq(name))
            .execute(conn)?;

        Ok(())
    }

    pub fn update_password(
        conn: &mut PgConnection,
        id: Uuid,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        let user = users::table.filter(users::id.eq(&id)).first::<User>(conn)?;

        let password_matches = hasher::verify(&current_password, &user.hash)?;

        if !password_matches {
            return Err(AppError::Unauthorized("Invalid password".into()));
        }

        let hashed_password = hasher::hash_password(new_password)?;

        diesel::update(users::table)
            .filter(users::id.eq(&id))
            .set(users::hash.eq(&hashed_password))
            .execute(conn)?;

        Ok(())
    }

    pub fn reset_pwd(
        conn: &mut PgConnection,
        confirmation_id: &Uuid,
        naive_password: &str,
    ) -> Result<(), AppError> {
        let hashed_password = hasher::hash_password(naive_password)?;

        let email = confirmations::table
            .select(confirmations::email)
            .filter(confirmations::id.eq(confirmation_id))
            .first::<String>(conn)?;

        diesel::update(users::table)
            .filter(users::email.eq(&email))
            .set(users::hash.eq(hashed_password))
            .execute(conn)?;

        // Cleanup confirmations
        diesel::delete(confirmations::table)
            .filter(confirmations::email.eq(&email))
            .execute(conn)?;

        Ok(())
    }
}

#[derive(Insertable, Debug)]
#[diesel(table_name = users)]
struct SignupUser<'a> {
    pub email: &'a str,
    pub hash: &'a str,
    pub name: &'a str,
}

#[derive(Debug, Serialize, Deserialize, Queryable, Insertable)]
#[diesel(table_name = confirmations)]
pub struct Confirmation {
    pub id: Uuid,
    pub email: String,
    pub expires_at: NaiveDateTime,
}

impl Confirmation {
    fn now() -> NaiveDateTime {
        Utc::now().naive_local()
    }

    /// Creates a new Confirmation in the DB for an email. If the email already exists resets its expiry time.
    pub fn create(
        conn: &mut PgConnection,
        email: &str,
        fail_if_user_exists: bool,
    ) -> Result<Self, AppError> {
        if fail_if_user_exists {
            if let Ok(_) = users::table
                .filter(users::email.eq(email))
                .first::<User>(conn)
            {
                return Err(AppError::UnprocessableEntity(vec![format!(
                    "User with email {} already exists.",
                    email
                )]));
            }
        }

        let res: Self = diesel::insert_into(confirmations::table)
            .values((
                &confirmations::email.eq(email),
                &confirmations::expires_at
                    .eq(Self::now().checked_add_signed(Duration::hours(48)).unwrap()),
            ))
            .on_conflict(confirmations::email)
            .do_update()
            .set(confirmations::expires_at.eq(excluded(confirmations::expires_at)))
            .get_result(conn)?;

        Ok(res)
    }

    /// Retrieves a not expired confirmation by its id
    pub fn get(conn: &mut PgConnection, id: &Uuid) -> Result<Self, AppError> {
        let res = confirmations::table
            .filter(confirmations::expires_at.gt(Self::now()))
            .filter(confirmations::id.eq(id))
            .first(conn)?;
        Ok(res)
    }
}
