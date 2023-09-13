use crate::middleware::{auth, state::AppState};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use serde::Deserialize;
use urlencoding::decode;

use super::{
    model::{DiaryDayEntry, DiaryEntryUpdate, IncompleteCob, ReportEntry},
    request,
    response::{DiaryDayResponse, IncompleteDays, ReportResponse},
};

/// Inserts or updates a single practice in a diary
pub async fn upsert_diary_day_entry(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<request::DiaryDayEntryUpsertRequest>,
    path: web::Path<CobSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob = path.into_inner();

    log::debug!("Upserting {:?}", form);

    web::block(move || {
        DiaryDayEntry::upsert_entry(
            &mut conn,
            &DiaryEntryUpdate {
                cob_date: &cob,
                user_id: &user_id,
                practice: &form.entry.practice,
                value: form.entry.value.as_ref(),
            },
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Inserts or updates a diary day
pub async fn upsert_diary_day(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<request::DiaryDayUpsertRequest>,
    path: web::Path<CobSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob = path.into_inner();

    log::debug!("Upserting {:?}", form);

    web::block(move || {
        DiaryDayEntry::upsert(
            &mut conn,
            &form
                .diary_day
                .iter()
                .map(|entry| DiaryEntryUpdate {
                    cob_date: &cob,
                    user_id: &user_id,
                    practice: &entry.practice,
                    value: entry.value.as_ref(),
                })
                .collect(),
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Retrieves a diary day
pub async fn get_diary_day(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<CobSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob = path.into_inner();

    let res = web::block(move || DiaryDayEntry::get_diary_day(&mut conn, &cob, &user_id)).await??;
    Ok(HttpResponse::Ok().json(DiaryDayResponse::from((cob, res))))
}

#[derive(Deserialize, Debug)]
pub struct ReportDataQueryParams {
    practice: Option<String>,
    duration: ReportDuration,
}

/// Retrieves user report data
pub async fn get_report_data(
    state: web::Data<AppState>,
    req: HttpRequest,
    params: web::Query<ReportDataQueryParams>,
    _path: web::Path<CobSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let practice = params
        .practice
        .as_ref()
        .map(|p| decode(p).map(|p| p.into_owned()))
        .transpose()?;

    let data = web::block(move || {
        ReportEntry::get_report_data(&mut conn, &user_id, &practice, &params.duration)
    })
    .await??;
    Ok(HttpResponse::Ok().json(ReportResponse::from(data)))
}

pub async fn get_incomplete_days(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<CobSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob = path.into_inner();

    let res =
        web::block(move || IncompleteCob::get_incomplete_days(&mut conn, &user_id, &cob)).await??;

    Ok(HttpResponse::Ok().json(IncompleteDays {
        days: res.iter().map(|c| c.cob_date).collect(),
    }))
}

type CobSlug = NaiveDate;

//TODO: add tests
