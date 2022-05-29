use actix_web::{
    web::{block, Data, Json},
    Result,
};
use errors::Error;

use db::{get_conn, models::User, PgPool};

pub async fn get_all(pool: Data<PgPool>) -> Result<Json<Vec<User>>, Error> {
    let connection = get_conn(&pool)?;

    let res = block(move || User::get_all(&connection)).await?;
    let users = res?;

    Ok(Json(users))
}

#[cfg(test)]
mod tests {
    use diesel::{Insertable, RunQueryDsl};

    use db::{get_conn, models::User, new_pool, schema::users};

    use crate::tests;

    #[derive(Debug, Insertable)]
    #[table_name = "users"]
    pub struct NewUser {
        pub name: String,
        pub email: String,
        pub pwd_hash: String,
    }

    #[actix_rt::test]
    async fn test_get_all_returns_users() {
        let pool = new_pool();
        let conn = get_conn(&pool).unwrap();

        diesel::insert_into(users::table)
            .values(NewUser {
                name: "dummy".to_string(),
                email: "dummy@gmail.com".to_string(),
                pwd_hash: "abcde".to_string(),
            })
            .execute(&conn)
            .unwrap();

        let res: (u16, Vec<User>) = tests::test_get("/api/users").await;
        assert_eq!(res.0, 200);
        assert_eq!(res.1.len(), 1);
        assert_eq!(res.1[0].email, "dummy@gmail.com");
    }
}
