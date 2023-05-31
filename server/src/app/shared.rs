use actix_web::{web, HttpRequest, HttpResponse};
use common::{error::AppError, ReportDuration};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    middleware::{auth, state::AppState},
    schema::shares,
};

use super::diary::{model::ReportEntry, response::ReportResponse};

#[derive(Identifiable, Insertable, Queryable, Debug)]
#[diesel(table_name = shares)]
pub struct Share {
    pub id: Uuid,
    pub user_id: Uuid,
}

impl Share {
    pub fn new(id: Uuid, user_id: Uuid) -> Self {
        Self { id, user_id }
    }

    pub fn get(conn: &mut PgConnection, id: &Uuid) -> Result<Self, AppError> {
        let res = shares::table.filter(shares::id.eq(&id)).first(conn)?;
        Ok(res)
    }

    pub fn get_all(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<Self>, AppError> {
        let res = shares::table
            .filter(shares::user_id.eq(&user_id))
            .get_results(conn)?;
        Ok(res)
    }

    pub fn create(conn: &mut PgConnection, user_id: &Uuid) -> Result<Self, AppError> {
        let res = diesel::insert_into(shares::table)
            .values(shares::user_id.eq(&user_id))
            .get_result(conn)?;

        Ok(res)
    }

    pub fn delete(conn: &mut PgConnection, share_id: &Uuid) -> Result<(), AppError> {
        diesel::delete(shares::table)
            .filter(shares::id.eq(&share_id))
            .execute(conn)?;

        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct ReportDataQueryParams {
    practice: String,
    duration: ReportDuration,
}

#[derive(Serialize, Debug)]
pub struct CreateShareResponse {
    pub share_id: Uuid,
}

impl From<Share> for CreateShareResponse {
    fn from(share: Share) -> Self {
        CreateShareResponse { share_id: share.id }
    }
}

#[derive(Serialize, Debug)]
pub struct GetAllSharesResponse {
    pub share_ids: Vec<Uuid>,
}

impl From<Vec<Share>> for GetAllSharesResponse {
    fn from(shares: Vec<Share>) -> Self {
        GetAllSharesResponse {
            share_ids: shares.iter().map(|share| share.id).collect(),
        }
    }
}

type ShareIdSlug = Uuid;

/// Get shared report data
pub async fn get_shared_report_data(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
    params: web::Query<ReportDataQueryParams>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let share_id = path.into_inner();

    let data = web::block(move || {
        let share = Share::get(&mut conn, &share_id)?;

        ReportEntry::get_report_data(
            &mut conn,
            &share.user_id,
            &params.practice,
            &params.duration,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(ReportResponse::from(data)))
}

/// Create a shared link to reports
pub async fn create_share_report_link(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || Share::create(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(CreateShareResponse::from(res)))
}

/// Delete a shared link to reports
pub async fn delete_share_report_link(
    state: web::Data<AppState>,
    path: web::Path<ShareIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let share_id = path.into_inner();

    web::block(move || Share::delete(&mut conn, &share_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get all shared links
pub async fn get_share_report_links(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || Share::get_all(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(GetAllSharesResponse::from(res)))
}
