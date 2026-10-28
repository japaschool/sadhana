use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use uuid::Uuid;

use super::{dto, service};
use crate::middleware::{auth, state::AppState};

pub async fn list_groups(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let groups = web::block(move || service::list(&mut conn, &user_id)).await??;
    Ok(HttpResponse::Ok().json(dto::GroupsResponse { groups }))
}

pub async fn create_group(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::NameForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = web::block(move || service::create(&mut conn, &user_id, &form.name)).await??;
    Ok(HttpResponse::Ok().json(dto::CreatedGroup { id }))
}

pub async fn rename_group(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<Uuid>,
    form: web::Json<dto::NameForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = path.into_inner();
    web::block(move || service::rename(&mut conn, &user_id, &id, &form.name)).await??;
    Ok(HttpResponse::Ok().json(()))
}

pub async fn delete_group(
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

pub async fn save_layout(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::Layout>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    web::block(move || service::save_layout(&mut conn, &user_id, &form)).await??;
    Ok(HttpResponse::Ok().json(()))
}
