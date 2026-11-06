use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;

use super::{dto, service};
use crate::middleware::{auth, state::AppState};

pub async fn get_prefs(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let prefs = web::block(move || service::get(&mut conn, &user_id)).await??;
    Ok(HttpResponse::Ok().json(dto::PrefsResponse { prefs }))
}

pub async fn save_prefs(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<dto::PrefsBody>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    web::block(move || service::save(&mut conn, &user_id, &body.prefs)).await??;
    Ok(HttpResponse::Ok().json(()))
}
