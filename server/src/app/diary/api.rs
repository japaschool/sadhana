use crate::middleware::{auth, state::AppState};
use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use common::error::AppError;
use serde::Deserialize;

use super::{
    model::{DiaryDayEntry, DiaryEntryUpdate},
    request,
    response::DiaryDayResponse,
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

    Ok(HttpResponse::Ok().finish())
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

//TODO: add tests
