use actix_web::{web, HttpResponse};
use common::error::AppError;
use serde::Deserialize;

use crate::{
    app::user::{model::User, response::UserResponse},
    middleware::state::AppState,
};

// ─── Google ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct GoogleBody {
    pub access_token: String,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
    email: String,
    name: Option<String>,
    given_name: Option<String>,
}

pub async fn google_signin(
    state: web::Data<AppState>,
    body: web::Json<GoogleBody>,
) -> Result<HttpResponse, AppError> {
    let client = reqwest::Client::new();
    let info: GoogleUserInfo = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&body.access_token)
        .send()
        .await
        .map_err(|_| AppError::InternalServerError)?
        .error_for_status()
        .map_err(|_| AppError::Unauthorized("Invalid Google access token".into()))?
        .json()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    let name = info
        .name
        .or(info.given_name)
        .unwrap_or_else(|| info.email.split('@').next().unwrap_or("User").to_string());
    let email = info.email;

    let mut conn = state.get_conn()?;
    let (user, token) = web::block(move || User::signin_oauth(&mut conn, &email, &name)).await??;
    Ok(HttpResponse::Ok().json(UserResponse::from((user, token))))
}

// ─── Apple ───────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AppleBody {
    pub id_token: String,
    pub name: Option<String>,
}

#[derive(Deserialize)]
struct AppleJwks {
    keys: Vec<AppleJwk>,
}

#[derive(Deserialize)]
struct AppleJwk {
    kid: String,
    n: String,
    e: String,
}

#[derive(Deserialize)]
struct AppleClaims {
    email: Option<String>,
}

pub async fn apple_signin(
    state: web::Data<AppState>,
    body: web::Json<AppleBody>,
) -> Result<HttpResponse, AppError> {
    let client = reqwest::Client::new();
    let jwks: AppleJwks = client
        .get("https://appleid.apple.com/auth/keys")
        .send()
        .await
        .map_err(|_| AppError::InternalServerError)?
        .json()
        .await
        .map_err(|_| AppError::InternalServerError)?;

    let header = jsonwebtoken::decode_header(&body.id_token)
        .map_err(|_| AppError::Unauthorized("Invalid Apple token".into()))?;
    let kid = header
        .kid
        .ok_or_else(|| AppError::Unauthorized("Missing kid in Apple token".into()))?;

    let jwk = jwks
        .keys
        .iter()
        .find(|k| k.kid == kid)
        .ok_or_else(|| AppError::Unauthorized("No matching Apple key found".into()))?;

    let decoding_key = jsonwebtoken::DecodingKey::from_rsa_components(&jwk.n, &jwk.e)
        .map_err(|_| AppError::InternalServerError)?;

    let mut validation =
        jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::RS256);
    validation.set_issuer(&["https://appleid.apple.com"]);
    validation.validate_aud = false;

    let claims =
        jsonwebtoken::decode::<AppleClaims>(&body.id_token, &decoding_key, &validation)
            .map_err(|_| AppError::Unauthorized("Apple token verification failed".into()))?
            .claims;

    let email = claims
        .email
        .ok_or_else(|| AppError::Unauthorized("No email in Apple token".into()))?;
    let name = body
        .name
        .clone()
        .unwrap_or_else(|| email.split('@').next().unwrap_or("User").to_string());

    let mut conn = state.get_conn()?;
    let (user, token) = web::block(move || User::signin_oauth(&mut conn, &email, &name)).await??;
    Ok(HttpResponse::Ok().json(UserResponse::from((user, token))))
}
