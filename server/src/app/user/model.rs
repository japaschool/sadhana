use crate::{
    hasher,
    schema::{confirmations, users},
    utils::token,
};
use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use common::error::AppError;
use diesel::{
    pg::PgConnection,
    prelude::*,
    sql_query,
    sql_types::{Text, Uuid as DieselUuid},
    upsert::excluded,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Identifiable, Queryable, Selectable, Serialize, Deserialize, Debug, Clone)]
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
        lang: &'a str,
        skip_defaults: bool,
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
            .returning(User::as_select())
            .get_result(conn)?;

        let token = user.generate_token()?;

        conn.transaction(|conn| {
            if !skip_defaults {
                sql_query(
                    r#"
            insert into user_practices (user_id, practice, data_type, is_active, order_key)
                select $1, practice, data_type, true, order_key
                from default_user_practices
                where lang = $2
            "#,
                )
                .bind::<DieselUuid, _>(&user.id)
                .bind::<Text, _>(&lang)
                .execute(conn)?;
            }

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
            .select(User::as_select())
            .filter(users::email.eq(email))
            .limit(1)
            .first(conn)?;
        let password_matches = hasher::verify(naive_password, &user.hash)?;

        if !password_matches {
            return Err(AppError::Unauthorized("Invalid password".into()));
        }

        let token = user.generate_token()?;
        Ok((user, token))
    }

    pub fn generate_token(&self) -> Result<Token, AppError> {
        let now = Utc::now().timestamp_nanos_opt().unwrap() / 1_000_000_000; // nanosecond -> second
        let token = token::generate(self.id, now)?;
        Ok(token)
    }

    pub fn signin_oauth(
        conn: &mut PgConnection,
        email: &str,
        name: &str,
        lang: &str,
        skip_defaults: bool,
    ) -> Result<(User, Token, bool), AppError> {
        if let Ok(user) = users::table
            .select(User::as_select())
            .filter(users::email.eq(email))
            .first(conn)
        {
            let token = user.generate_token()?;
            return Ok((user, token, false));
        }

        let hashed = hasher::hash_password(&uuid::Uuid::new_v4().to_string())?;
        let record = SignupUser {
            email,
            hash: &hashed,
            name,
        };
        let user = diesel::insert_into(users::table)
            .values(&record)
            .returning(User::as_select())
            .get_result(conn)?;

        if !skip_defaults {
            sql_query(
                r#"INSERT INTO user_practices (user_id, practice, data_type, is_active, order_key)
               SELECT $1, practice, data_type, true, order_key
               FROM default_user_practices WHERE lang = $2"#,
            )
            .bind::<DieselUuid, _>(&user.id)
            .bind::<Text, _>(lang)
            .execute(conn)?;
        }

        let token = user.generate_token()?;
        Ok((user, token, true))
    }

    pub fn find(conn: &mut PgConnection, id: &Uuid) -> Result<Self, AppError> {
        let user = users::table
            .find(id)
            .select(User::as_select())
            .first(conn)?;
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
        let user = users::table
            .select(User::as_select())
            .filter(users::id.eq(&id))
            .first(conn)?;

        let password_matches = hasher::verify(current_password, &user.hash)?;

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
        if fail_if_user_exists
            && users::table
                .select(User::as_select())
                .filter(users::email.eq(email))
                .first(conn)
                .is_ok()
        {
            return Err(AppError::UnprocessableEntity(vec![format!(
                "User with email {} already exists.",
                email
            )]));
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

#[cfg(test)]
mod tests {
    use super::User;
    use crate::{app::user::request::SignupUser, schema::users, utils::db};
    use diesel::{
        prelude::*,
        sql_query,
        sql_types::{BigInt, Text},
    };

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        n: i64,
    }

    fn practices(conn: &mut PgConnection, email: &str) -> i64 {
        sql_query(
            "select count(*) as n from user_practices where user_id in (select id from users where email = $1)",
        )
        .bind::<Text, _>(email)
        .get_result::<Count>(conn)
        .unwrap()
        .n
    }

    fn delete_user(conn: &mut PgConnection, email: &str) {
        sql_query(
            "delete from user_practices where user_id in (select id from users where email = $1)",
        )
        .bind::<Text, _>(email)
        .execute(conn)
        .unwrap();
        diesel::delete(users::table.filter(users::email.eq(email)))
            .execute(conn)
            .unwrap();
    }

    #[test]
    fn signup_without_the_field_seeds() {
        let body = r#"{"email":"a@b.co","password":"abcdef","name":"Abc","lang":"en","confirmation_id":"0f8fad5b-d9cb-469f-a165-70867728950e"}"#;
        let parsed: SignupUser = serde_json::from_str(body).unwrap();
        assert!(!parsed.skip_defaults);

        let mut conn = db::establish_connection().get().unwrap();
        let email = "skip_absent@test.co";
        delete_user(&mut conn, email);
        User::signup(
            &mut conn,
            email,
            "Skip",
            "abcdef",
            "en",
            parsed.skip_defaults,
        )
        .unwrap();
        assert!(practices(&mut conn, email) > 0);
        delete_user(&mut conn, email);
    }

    #[test]
    fn signup_with_skip_defaults_seeds_nothing() {
        let mut conn = db::establish_connection().get().unwrap();
        let email = "skip_true@test.co";
        delete_user(&mut conn, email);
        User::signup(&mut conn, email, "Skip", "abcdef", "en", true).unwrap();
        assert_eq!(practices(&mut conn, email), 0);
        delete_user(&mut conn, email);
    }

    #[test]
    fn oauth_created_only_once() {
        let mut conn = db::establish_connection().get().unwrap();
        let email = "oauth_once@test.co";
        delete_user(&mut conn, email);

        let (_, _, created) = User::signin_oauth(&mut conn, email, "Oa", "en", true).unwrap();
        assert!(created);
        assert_eq!(practices(&mut conn, email), 0);

        // A returning user is untouched, whatever the flag says.
        let (_, _, created) = User::signin_oauth(&mut conn, email, "Oa", "en", false).unwrap();
        assert!(!created);
        assert_eq!(practices(&mut conn, email), 0);

        delete_user(&mut conn, email);
        let (_, _, created) = User::signin_oauth(&mut conn, email, "Oa", "en", false).unwrap();
        assert!(created);
        let seeded = practices(&mut conn, email);
        assert!(seeded > 0);
        let (_, _, created) = User::signin_oauth(&mut conn, email, "Oa", "en", true).unwrap();
        assert!(!created);
        assert_eq!(practices(&mut conn, email), seeded);
        delete_user(&mut conn, email);
    }
}
