use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use uuid::Uuid;

use super::{dto, service};
use crate::middleware::{auth, state::AppState};

pub async fn list_periods(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let periods = web::block(move || service::list(&mut conn, &user_id)).await??;
    Ok(HttpResponse::Ok().json(dto::PeriodsResponse { periods }))
}

pub async fn create_period(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::MarkedPeriodForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = web::block(move || service::create(&mut conn, &user_id, &form)).await??;
    Ok(HttpResponse::Ok().json(dto::CreatedPeriod { id }))
}

pub async fn update_period(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<Uuid>,
    form: web::Json<dto::MarkedPeriodForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = path.into_inner();
    web::block(move || service::update(&mut conn, &user_id, &id, &form)).await??;
    Ok(HttpResponse::Ok().json(()))
}

pub async fn delete_period(
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
