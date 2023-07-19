use actix_web::{web, HttpResponse};
use common::{error::AppError, ReportDuration};
use serde::Deserialize;
use uuid::Uuid;

use crate::middleware::state::AppState;

use super::{
    diary::{model::ReportEntry, response::ReportResponse},
    user_practices::{AllUserPracticesResponse, UserPractice},
};

#[derive(Deserialize, Debug)]
pub struct ReportDataQueryParams {
    practice: String,
    duration: ReportDuration,
}

type UserIdSlug = Uuid;

/// Get shared report data
pub async fn get_shared_report_data(
    state: web::Data<AppState>,
    path: web::Path<UserIdSlug>,
    params: web::Query<ReportDataQueryParams>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = path.into_inner();

    let data = web::block(move || {
        ReportEntry::get_report_data(&mut conn, &user_id, &params.practice, &params.duration)
    })
    .await??;

    Ok(HttpResponse::Ok().json(ReportResponse::from(data)))
}

/// Get shared report data
pub async fn get_shared_report_practices(
    state: web::Data<AppState>,
    path: web::Path<UserIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = path.into_inner();

    let data = web::block(move || UserPractice::all_user_practices(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(AllUserPracticesResponse::from(data)))
}
