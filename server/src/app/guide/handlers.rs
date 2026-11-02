use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use uuid::Uuid;

use super::{dto, service};
use crate::middleware::{auth, state::AppState};

pub async fn start_run(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<dto::StartForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = web::block(move || service::start(&mut conn, &user_id, form.started_from)).await??;
    Ok(HttpResponse::Ok().json(dto::Started { id }))
}

pub async fn update_run(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<Uuid>,
    form: web::Json<dto::UpdateForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let id = path.into_inner();
    web::block(move || service::update(&mut conn, &user_id, &id, &form)).await??;
    Ok(HttpResponse::Ok().json(()))
}
