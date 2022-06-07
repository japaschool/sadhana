use actix_web::{
    web::{block, Data, Json},
    Result,
};
use errors::Error;
use serde::{Deserialize, Serialize};
use validator::Validate;

use db::{
    get_conn,
    models::{NewUser, User},
    PgPool,
};

use crate::validation::validate;

#[derive(Clone, Deserialize, Serialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email)]
    email: String,
    #[validate(length(min = 5))]
    hash: String,
    #[validate(length(min = 3))]
    name: String,
}

pub async fn create(
    pool: Data<PgPool>,
    params: Json<CreateUserRequest>,
) -> Result<Json<User>, Error> {
    validate(&params)?;

    let connection = get_conn(&pool)?;

    let res = block(move || {
        User::create(
            &connection,
            NewUser {
                email: params.email.clone(),
                hash: params.hash.clone(),
                name: params.name.clone(),
            },
        )
    })
    .await?;
    let user = res?;

    Ok(Json(user))
}

#[cfg(test)]
mod tests {
    use crate::test_helpers;
    use db::{
        get_conn,
        models::{NewUser, User},
        new_pool,
        schema::users,
    };
    use diesel::RunQueryDsl;
    use errors::ErrorResponse;

    #[actix_rt::test]
    pub async fn test_create_user() {
        let pool = new_pool();
        let conn = get_conn(&pool).unwrap();

        let res: (u16, User) = test_helpers::test_post(
            "/api/users",
            NewUser {
                email: "xyz@gmail.com".into(),
                hash: "abcdef".into(),
                name: "X Yz".into(),
            },
        )
        .await;

        assert_eq!(res.0, 200);
        assert_eq!(res.1.email, "xyz@gmail.com");

        let result_users = users::dsl::users.load::<User>(&conn).unwrap();
        assert_eq!(result_users.len(), 1);
        assert_eq!(result_users[0].email, "xyz@gmail.com");

        diesel::delete(users::dsl::users).execute(&conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_create_email_validation() {
        let pool = new_pool();
        let conn = get_conn(&pool).unwrap();

        // note here how the deserialize type has changed
        let res: (u16, ErrorResponse) = test_helpers::test_post(
            "/api/users",
            NewUser {
                email: "xyz".into(),
                hash: "abcdef".into(),
                name: "X Yz".into(),
            },
        )
        .await;

        assert_eq!(res.0, 422);
        assert_eq!(res.1.errors, vec!["email is required"]);

        let result_users = users::dsl::users.load::<User>(&conn).unwrap();
        assert_eq!(result_users.len(), 0);
    }
}
