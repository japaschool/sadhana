use crate::{
    middleware::{auth, state::AppState},
    utils::emails::send_email_smtp,
    vars,
};
use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use uuid::Uuid;
use validator::Validate;

use super::{
    model::{Confirmation, User},
    request,
    response::{ConfirmationResponse, UserResponse},
};

pub async fn signin(
    state: web::Data<AppState>,
    form: web::Json<request::Signin>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (user, token) =
        web::block(move || User::signin(&mut conn, &form.user.email, &form.user.password))
            .await??;
    let res = UserResponse::from((user, token));
    Ok(HttpResponse::Ok().json(res))
}

pub async fn signup(
    state: web::Data<AppState>,
    form: web::Json<request::Signup>,
) -> Result<HttpResponse, AppError> {
    form.user.validate()?;

    let mut conn = state.get_conn()?;
    let (user, token) = web::block(move || {
        User::signup(
            &mut conn,
            &form.user.email,
            &form.user.name,
            &form.user.password,
        )
    })
    .await??;
    let res = UserResponse::from((user, token));
    Ok(HttpResponse::Ok().json(res))
}

pub async fn send_signup_link(
    state: web::Data<AppState>,
    form: web::Json<request::SendSignupLink>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let email = form.email.clone();

    let confirmation = web::block(move || Confirmation::create(&mut conn, &email)).await??;

    let html_text = format!(
        "Please click on the link below to complete registration. <br/>
                <a href=\"{domain}/register/{id}\">Complete registration</a> <br/>
                This link expires on <strong>{expires}</strong>",
        domain = vars::public_server_address(),
        id = confirmation.id,
        expires = confirmation.expires_at
    );

    send_email_smtp(form.email.as_str(), "Complete your registration", html_text).await?;

    Ok(HttpResponse::Ok().json(()))
}

type ConfirmationIdSlug = Uuid;

pub async fn signup_link_details(
    state: web::Data<AppState>,
    // req: HttpRequest,
    path: web::Path<ConfirmationIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let id = path.into_inner();
    let confirmation = web::block(move || Confirmation::get(&mut conn, &id)).await??;

    Ok(HttpResponse::Ok().json(ConfirmationResponse::from(confirmation)))
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
        let mut conn = pool.get().unwrap();

        let cleanup = || diesel::delete(users.filter(email.eq("xyz@gmail.com")));
        let _ = cleanup().execute(&mut conn);

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

        cleanup().execute(&mut conn).unwrap();
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
        let mut conn = pool.get().unwrap();

        let test_email = "dup_test@gmail.com";
        let payload = Signup {
            user: SignupUser {
                email: test_email.into(),
                password: "abcdef".into(),
                name: "X Yz".into(),
            },
        };

        let cleanup = || diesel::delete(users.filter(email.eq(test_email)));
        let _ = cleanup().execute(&mut conn);

        let res: (u16, UserResponse) = test_helpers::test_post("/api/users", &payload).await;

        assert_eq!(res.0, 200);
        assert_eq!(res.1.user.email, test_email);

        let res = test_helpers::test_post_status("/api/users", &payload).await;

        assert_eq!(res, 422);

        cleanup().execute(&mut conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_signin() {
        let pool = db::establish_connection();
        let mut conn = pool.get().unwrap();

        let test_email = "signin_test@gmail.com";
        let test_pwd = "abcdef";

        let payload = Signup {
            user: SignupUser {
                email: test_email.into(),
                password: test_pwd.into(),
                name: "X Yz".into(),
            },
        };

        let cleanup = || diesel::delete(users.filter(email.eq(test_email)));
        let _ = cleanup().execute(&mut conn);

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

        cleanup().execute(&mut conn).unwrap();
    }

    #[actix_rt::test]
    pub async fn test_me() {
        todo!()
    }
}
