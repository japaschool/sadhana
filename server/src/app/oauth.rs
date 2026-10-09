use actix_web::{web, HttpResponse};
use common::error::AppError;
use serde::Deserialize;

use crate::{
    app::user::{model::User, response::UserResponse},
    middleware::state::AppState,
    vars,
};

#[derive(Deserialize)]
pub struct GoogleBody {
    pub access_token: String,
}

#[derive(Deserialize)]
struct GoogleTokenInfo {
    aud: String,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
    email: String,
    #[serde(default)]
    email_verified: bool,
    name: Option<String>,
    given_name: Option<String>,
}

fn unauthorized() -> AppError {
    AppError::Unauthorized("Invalid Google access token".into())
}

/// The token must be issued to our client (else any app's token signs in as its user),
/// and Google must have verified the email, since sign-in links to an existing account by email.
fn check_google(
    client_id: Option<&str>,
    aud: &str,
    email_verified: bool,
) -> Result<(), AppError> {
    match client_id {
        Some(id) if !id.is_empty() && id == aud && email_verified => Ok(()),
        _ => Err(unauthorized()),
    }
}

pub async fn google_signin(
    state: web::Data<AppState>,
    body: web::Json<GoogleBody>,
) -> Result<HttpResponse, AppError> {
    let client = reqwest::Client::new();
    let token_info: GoogleTokenInfo = client
        .get("https://oauth2.googleapis.com/tokeninfo")
        .query(&[("access_token", &body.access_token)])
        .send()
        .await
        .map_err(|_| AppError::InternalServerError)?
        .error_for_status()
        .map_err(|_| unauthorized())?
        .json()
        .await
        .map_err(|_| unauthorized())?;

    let info: GoogleUserInfo = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&body.access_token)
        .send()
        .await
        .map_err(|_| AppError::InternalServerError)?
        .error_for_status()
        .map_err(|_| unauthorized())?
        .json()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    check_google(
        vars::google_client_id().as_deref(),
        &token_info.aud,
        info.email_verified,
    )?;

    let name = info
        .name
        .or(info.given_name)
        .unwrap_or_else(|| info.email.split('@').next().unwrap_or("User").to_string());
    let email = info.email;

    let mut conn = state.get_conn()?;
    let (user, token) = web::block(move || User::signin_oauth(&mut conn, &email, &name)).await??;
    Ok(HttpResponse::Ok().json(UserResponse::from((user, token))))
}

#[cfg(test)]
mod tests {
    use super::check_google;

    #[test]
    fn google_token_checks() {
        assert!(check_google(Some("ours"), "ours", true).is_ok());
        assert!(check_google(Some("ours"), "theirs", true).is_err());
        assert!(check_google(Some("ours"), "ours", false).is_err());
        assert!(check_google(None, "ours", true).is_err());
        assert!(check_google(Some(""), "", true).is_err());
    }
}
