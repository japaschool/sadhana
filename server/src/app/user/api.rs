use actix_web::{web, HttpRequest, HttpResponse};
use validator::Validate;

use crate::{
    error::AppError,
    middleware::{auth, state::AppState},
};

use super::{model::User, request, response::UserResponse};

pub async fn signin(
    state: web::Data<AppState>,
    form: web::Json<request::Signin>,
) -> Result<HttpResponse, AppError> {
    let conn = state.get_conn()?;
    debug!("Trying to login {:?}", form.user);
    let (user, token) = User::signin(&conn, &form.user.email, &form.user.password)?;
    debug!(
        "Successfully logged in user {:?} with token {}",
        user, token
    );
    let res = UserResponse::from((user, token));
    Ok(HttpResponse::Ok().json(res))
}

pub async fn signup(
    state: web::Data<AppState>,
    form: web::Json<request::Signup>,
) -> Result<HttpResponse, AppError> {
    form.user.validate()?;

    let conn = state.get_conn()?;
    let (user, token) = User::signup(
        &conn,
        &form.user.email,
        &form.user.name,
        &form.user.password,
    )?;
    let res = UserResponse::from((user, token));
    Ok(HttpResponse::Ok().json(res))
}

pub async fn me(req: HttpRequest) -> Result<HttpResponse, AppError> {
    let user = auth::get_current_user(&req)?;
    let token = user.generate_token()?;
    let res = UserResponse::from((user, token));
    Ok(HttpResponse::Ok().json(res))
}

#[cfg(test)]
mod tests {
    use crate::{
        app::user::{
            model::User,
            request::{Signup, SignupUser},
            response::UserResponse,
        },
        schema::users,
        utils::{db, test_helpers},
    };
    use diesel::RunQueryDsl;

    fn init() {
        let _ = env_logger::builder().is_test(true).try_init();
    }

    #[actix_rt::test]
    pub async fn test_me_fails_without_auth_header() {
        init();

        let res = test_helpers::test_get_status("/api/user").await;

        assert_eq!(res, 401);
    }

    // FIXME: figure out why this test fails
    #[ignore]
    #[actix_rt::test]
    pub async fn test_signup() {
        init();
        let pool = db::establish_connection();
        let conn = pool.get().unwrap();

        let res: (u16, UserResponse) = test_helpers::test_post(
            "/api/users",
            Signup {
                user: SignupUser {
                    email: "xyz@gmail.com".into(),
                    password: "abcdef".into(),
                    name: "X Yz".into(),
                },
            },
        )
        .await;

        assert_eq!(res.0, 200);
        assert_eq!(res.1.user.email, "xyz@gmail.com");

        let result_users = users::dsl::users.load::<User>(&conn).unwrap();
        assert_eq!(result_users.len(), 1);
        assert_eq!(result_users[0].email, "xyz@gmail.com");

        diesel::delete(users::dsl::users).execute(&conn).unwrap();
    }
}
