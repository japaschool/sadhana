use std::collections::HashSet;

use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use diesel::prelude::*;
use diesel::{PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app::report::db::Report;
use crate::app::report::{GraphReport, GridReport, PracticeTrace, ReportDefinition, TraceType};
use crate::db_types::{BarLayout, PracticeDataType};
use crate::middleware::auth;
use crate::middleware::state::AppState;
use crate::schema::{diary, report_traces, user_practices, yatra_user_practices};

#[derive(Debug, Queryable, Serialize, Deserialize)]
pub struct UserPractice {
    #[diesel(sql_type = DieselUuid)]
    pub id: Uuid,
    #[diesel(sql_type = Text)]
    pub practice: String,
    #[diesel(sql_type = PracticeDataTypeEnum)]
    pub data_type: PracticeDataType,
    #[diesel(sql_type = Bool)]
    pub is_active: bool,
    #[diesel(sql_type = Nullable<Bool>)]
    pub is_required: Option<bool>,
}

impl UserPractice {
    pub fn get(conn: &mut PgConnection, practice: &Uuid) -> Result<Self, AppError> {
        let res = user_practices::table
            .select((
                user_practices::id,
                user_practices::practice,
                user_practices::data_type,
                user_practices::is_active,
                user_practices::is_required,
            ))
            .filter(user_practices::id.eq(&practice))
            .first(conn)?;

        Ok(res)
    }

    pub fn all_user_practices(
        conn: &mut PgConnection,
        user_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = user_practices::table
            .select((
                user_practices::id,
                user_practices::practice,
                user_practices::data_type,
                user_practices::is_active,
                user_practices::is_required,
            ))
            .filter(user_practices::user_id.eq(user_id))
            .order(user_practices::order_key)
            .load(conn)?;

        Ok(res)
    }

    pub fn update(
        conn: &mut PgConnection,
        user_id: &Uuid,
        practice: &Uuid,
        new_name: &str,
        is_active: bool,
        is_required: Option<bool>,
    ) -> Result<(), AppError> {
        diesel::update(user_practices::table)
            .set((
                user_practices::practice.eq(new_name),
                user_practices::is_active.eq(is_active),
                user_practices::is_required.eq(is_required),
            ))
            .filter(
                user_practices::user_id
                    .eq(user_id)
                    .and(user_practices::id.eq(&practice)),
            )
            .execute(conn)?;
        Ok(())
    }

    pub fn update_order_key(
        conn: &mut PgConnection,
        user_id: &Uuid,
        data: &Vec<UpdateUserPracticeOrderKey>,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            for row in data {
                diesel::update(user_practices::table)
                    .set(user_practices::order_key.eq(row.order_key))
                    .filter(
                        user_practices::user_id
                            .eq(user_id)
                            .and(user_practices::id.eq(&row.practice)),
                    )
                    .execute(conn)?;
            }
            Ok(())
        })
    }

    pub fn delete(
        conn: &mut PgConnection,
        user_id: &Uuid,
        practice: &Uuid,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            diesel::delete(diary::table)
                .filter(
                    diary::user_id
                        .eq(&user_id)
                        .and(diary::practice_id.eq(&practice)),
                )
                .execute(conn)?;

            diesel::delete(yatra_user_practices::table)
                .filter(yatra_user_practices::user_practice_id.eq(&practice))
                .execute(conn)?;

            diesel::delete(report_traces::table)
                .filter(report_traces::practice_id.eq(&practice))
                .execute(conn)?;

            let order_key: i32 = user_practices::table
                .select(user_practices::order_key)
                .filter(user_practices::id.eq(&practice))
                .first(conn)?;

            diesel::delete(user_practices::table)
                .filter(
                    user_practices::user_id
                        .eq(user_id)
                        .and(user_practices::id.eq(&practice)),
                )
                .execute(conn)?;

            // Shift order key on practices with order key greater than deleted
            diesel::update(user_practices::table)
                .set(user_practices::order_key.eq(user_practices::order_key - 1))
                .filter(
                    user_practices::user_id
                        .eq(&user_id)
                        .and(user_practices::order_key.gt(order_key)),
                )
                .execute(conn)
        })?;

        Ok(())
    }

    pub fn create(conn: &mut PgConnection, record: &NewUserPractice) -> Result<(), AppError> {
        use crate::schema::user_practices::dsl::*;

        conn.transaction(|conn| {
            let max_order_key: Option<i32> = user_practices
                .filter(user_id.eq(&record.user_id))
                .select(diesel::dsl::max(order_key))
                .first(conn)?;

            let practice_id: Uuid = diesel::insert_into(user_practices)
                .values((
                    user_id.eq(record.user_id),
                    practice.eq(&record.practice),
                    data_type.eq(&record.data_type),
                    is_active.eq(record.is_active),
                    is_required.eq(record.is_required),
                    order_key.eq(max_order_key.unwrap_or_default() + 1),
                ))
                .returning(id)
                .get_result(conn)?;

            let report_definition = match record.data_type {
                PracticeDataType::Bool | PracticeDataType::Text => {
                    ReportDefinition::Grid(GridReport {
                        practices: HashSet::from([practice_id]),
                    })
                }
                _ => ReportDefinition::Graph(GraphReport {
                    bar_layout: BarLayout::Grouped,
                    traces: vec![PracticeTrace::new_minimal(TraceType::Bar, practice_id)],
                }),
            };

            Report::create(conn, &record.user_id, &record.practice, &report_definition)
                .map(|_| ())
                .or_else(|err| match err {
                    AppError::UnprocessableEntity(msgs) => {
                        log::warn!("Suppressed a failure to create a new report while creating a new practice {} for user {} with the following message: {}", record.practice, record.user_id, msgs.join("\n"));
                        Ok(())},
                    e => Err(e),
                })?;

            Ok(())
        })
    }
}

/// Retrieves user practice
pub async fn get_user_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<PracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;

    auth::get_current_user(&req)?;

    let practice = path.into_inner();

    let res = web::block(move || UserPractice::get(&mut conn, &practice)).await??;
    Ok(HttpResponse::Ok().json(GetUserPractice { practice: res }))
}

/// Retrieves all user practices
pub async fn get_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || UserPractice::all_user_practices(&mut conn, &user_id)).await??;
    Ok(HttpResponse::Ok().json(AllUserPracticesResponse::from(res)))
}

#[derive(Serialize, Debug)]
pub struct GetUserPractice {
    pub practice: UserPractice,
}

#[derive(Serialize, Debug)]
pub struct AllUserPracticesResponse {
    pub user_practices: Vec<UserPractice>,
}

impl From<Vec<UserPractice>> for AllUserPracticesResponse {
    fn from(user_practices: Vec<UserPractice>) -> Self {
        Self { user_practices }
    }
}

type PracticeSlug = Uuid;

/// Deletes a user practice
/// Note it also deletes any dependent diary entries
pub async fn delete_user_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<PracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let practice = path.into_inner();

    web::block(move || UserPractice::delete(&mut conn, &user_id, &practice)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Updates a user practice
pub async fn update_user_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<PracticeSlug>,
    form: web::Json<UpdateUserPracticeRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let practice = path.into_inner();

    web::block(move || {
        UserPractice::update(
            &mut conn,
            &user_id,
            &practice,
            &form.user_practice.practice,
            form.user_practice.is_active,
            form.user_practice.is_required,
        )
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Updates order key for all practices of a particular user
pub async fn update_user_practice_order_key(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<UpdateUserPracticeOrderKeyRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let data = form
        .practices
        .iter()
        .enumerate()
        .map(|(idx, practice)| UpdateUserPracticeOrderKey {
            practice: *practice,
            order_key: idx as i32,
        })
        .collect();

    web::block(move || UserPractice::update_order_key(&mut conn, &user_id, &data)).await??;
    Ok(HttpResponse::Ok().json(()))
}

/// Adds a new user practice
pub async fn add_new(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<NewUserPracticeRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let record = NewUserPractice {
        user_id,
        practice: form.user_practice.practice.clone(),
        data_type: form.user_practice.data_type.clone(),
        is_active: form.user_practice.is_active,
        is_required: form.user_practice.is_required,
    };
    web::block(move || UserPractice::create(&mut conn, &record)).await??;
    Ok(HttpResponse::Ok().json(()))
}

#[derive(Debug, Insertable)]
#[diesel(table_name=user_practices)]
pub struct NewUserPractice {
    user_id: Uuid,
    practice: String,
    data_type: PracticeDataType,
    is_active: bool,
    is_required: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct NewUserPracticeForm {
    practice: String,
    data_type: PracticeDataType,
    is_active: bool,
    is_required: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct NewUserPracticeRequest {
    user_practice: NewUserPracticeForm,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPracticeRequest {
    user_practice: UserPractice,
}

#[derive(Debug)]
pub struct UpdateUserPracticeOrderKey {
    pub practice: Uuid,
    pub order_key: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPracticeOrderKeyRequest {
    practices: Vec<Uuid>,
}
