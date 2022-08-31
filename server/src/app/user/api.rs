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
    let (user, token) = User::signin(&conn, &form.user.email, &form.user.password)?;
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
            request::{Signin, SigninUser, Signup, SignupUser},
            response::UserResponse,
        },
        schema::users::dsl::*,
        utils::{db, test_helpers},
    };
    use diesel::prelude::*;
    use diesel::{QueryDsl, RunQueryDsl};

    fn init() {
        let _ = env_logger::builder().is_test(true).try_init();
    }

    #[actix_rt::test]
    pub async fn test_me_fails_without_auth_header() {
        init();

        let res = test_helpers::test_get_status("/api/user").await;

        assert_eq!(res, 401);
    }

    #[actix_rt::test]
    pub async fn test_signup() {
        init();

        let pool = db::establish_connection();
        let conn = pool.get().unwrap();

        let cleanup = diesel::delete(users.filter(email.eq("xyz@gmail.com")));
        let _ = cleanup.execute(&conn);

        let res: (u16, UserResponse) = test_helpers::test_post(
            "/api/users",
            &Signup {
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

        cleanup.execute(&conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_signup_validations() {
        init();

        let mut res: (u16, Vec<String>) = test_helpers::test_post(
            "/api/users",
            &Signup {
                user: SignupUser {
                    email: "invalid email".into(),
                    password: "".into(),
                    name: "a".into(),
                },
            },
        )
        .await;

        assert_eq!(res.0, 422);

        let mut expected = vec![
            "password must be at least 5 symbols long",
            "name must be at least 3 letters long",
            "email is malformed",
        ];

        assert_eq!(res.1.sort(), expected.sort());
    }

    #[actix_rt::test]
    pub async fn test_signup_duplicate() {
        let pool = db::establish_connection();
        let conn = pool.get().unwrap();

        let test_email = "dup_test@gmail.com";
        let payload = Signup {
            user: SignupUser {
                email: test_email.into(),
                password: "abcdef".into(),
                name: "X Yz".into(),
            },
        };

        let cleanup = diesel::delete(users.filter(email.eq(test_email)));
        let _ = cleanup.execute(&conn);

        let res: (u16, UserResponse) = test_helpers::test_post("/api/users", &payload).await;

        assert_eq!(res.0, 200);
        assert_eq!(res.1.user.email, test_email);

        let res = test_helpers::test_post_status("/api/users", &payload).await;

        assert_eq!(res, 422);

        cleanup.execute(&conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_signin() {
        let pool = db::establish_connection();
        let conn = pool.get().unwrap();

        let test_email = "signin_test@gmail.com";
        let test_pwd = "abcdef";

        let payload = Signup {
            user: SignupUser {
                email: test_email.into(),
                password: test_pwd.into(),
                name: "X Yz".into(),
            },
        };

        let cleanup = diesel::delete(users.filter(email.eq(test_email)));
        let _ = cleanup.execute(&conn);

        let res = test_helpers::test_post_status("/api/users", &payload).await;

        assert_eq!(res, 200);

        let payload = Signin {
            user: SigninUser {
                email: test_email.into(),
                password: test_pwd.into(),
            },
        };

        let res = test_helpers::test_post_status("/api/users/login", &payload).await;

        assert_eq!(res, 200);

        let payload = Signin {
            user: SigninUser {
                email: test_email.into(),
                password: "wrong password".into(),
            },
        };

        let res = test_helpers::test_post_status("/api/users/login", &payload).await;

        assert_eq!(res, 401);

        cleanup.execute(&conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_me() {
        todo!()
    }
}
