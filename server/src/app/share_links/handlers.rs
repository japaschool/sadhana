use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use uuid::Uuid;

use super::{dto, service};
use crate::middleware::{auth, state::AppState};

pub async fn list_links(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let res = web::block(move || service::list(&mut conn, &user_id)).await??;
    Ok(HttpResponse::Ok().json(res))
}

pub async fn create_link(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::ShareLinkForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = web::block(move || service::create(&mut conn, &user_id, &form)).await??;
    Ok(HttpResponse::Ok().json(dto::CreatedShareLink { id }))
}

pub async fn update_link(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<Uuid>,
    form: web::Json<dto::ShareLinkForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = path.into_inner();
    web::block(move || service::update(&mut conn, &user_id, &id, &form)).await??;
    Ok(HttpResponse::Ok().json(()))
}

pub async fn delete_link(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<Uuid>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = path.into_inner();
    web::block(move || service::delete(&mut conn, &user_id, &id)).await??;
    Ok(HttpResponse::Ok().json(()))
}

pub async fn set_legacy(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::LegacyShareForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    web::block(move || service::set_legacy(&mut conn, &user_id, form.enabled)).await??;
    Ok(HttpResponse::Ok().json(()))
}
