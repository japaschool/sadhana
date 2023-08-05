use crate::middleware::{auth, state::AppState};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use serde::Deserialize;
use urlencoding::decode;

use super::{
    model::{DiaryDayEntry, DiaryEntryUpdate, ReportEntry},
    request,
    response::{DiaryDayResponse, ReportResponse},
};

#[derive(Deserialize, Debug)]
pub struct DiaryDayQueryParams {
    cob_date: NaiveDate,
}

/// Inserts or updates a diary day
pub async fn upsert_diary_day(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<request::DiaryDayUpsertRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    log::debug!("Upserting {:?}", form);

    web::block(move || {
        DiaryDayEntry::upsert(
            &mut conn,
            &form
                .diary_day
                .iter()
                .map(|entry| DiaryEntryUpdate {
                    cob_date: &form.cob_date,
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
    params: web::Query<DiaryDayQueryParams>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob = params.cob_date.clone();

    let res = web::block(move || DiaryDayEntry::get_diary_day(&mut conn, &cob, &user_id)).await??;
    Ok(HttpResponse::Ok().json(DiaryDayResponse::from((params.cob_date, res))))
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

//TODO: add tests
