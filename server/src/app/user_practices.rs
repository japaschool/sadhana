use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use diesel::prelude::*;
use diesel::{sql_query, sql_types::Uuid as DieselUuid, sql_types::*, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db_types::PracticeDataType;
use crate::middleware::auth;
use crate::middleware::state::AppState;
use crate::schema::user_practices;

#[derive(Debug, Queryable, Serialize, Deserialize)]
pub struct UserPractice {
    #[diesel(sql_type = Text)]
    pub practice: String,
    #[diesel(sql_type = PracticeDataTypeEnum)]
    pub data_type: PracticeDataType,
    #[diesel(sql_type = Bool)]
    pub is_active: bool,
}

impl UserPractice {
    pub fn all_user_practices(
        conn: &mut PgConnection,
        user_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = user_practices::table
            .select((
                user_practices::practice,
                user_practices::data_type,
                user_practices::is_active,
            ))
            .filter(user_practices::user_id.eq(user_id))
            .load(conn)?;

        Ok(res)
    }

    pub fn update(
        conn: &mut PgConnection,
        user_id: &Uuid,
        practice: &str,
        new_name: &str,
        is_active: bool,
    ) -> Result<(), AppError> {
        diesel::update(user_practices::table)
            .set((
                user_practices::practice.eq(new_name),
                user_practices::is_active.eq(is_active),
            ))
            .filter(
                user_practices::user_id
                    .eq(user_id)
                    .and(user_practices::practice.eq(practice)),
            )
            .execute(conn)?;
        Ok(())
    }

    pub fn delete(conn: &mut PgConnection, user_id: &Uuid, practice: &str) -> Result<(), AppError> {
        conn.transaction(|conn| {
            sql_query(
                r#"
                delete from diary 
                where user_id = $1 
                and practice_id in (
                    select id from user_practices 
                    where user_id = $1 and practice = $2
                ) 
            "#,
            )
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(practice)
            .execute(conn)?;

            sql_query(
                r#"
                delete from user_practices 
                where user_id = $1 and practice = $2
            "#,
            )
            .bind::<DieselUuid, _>(user_id)
            .bind::<Text, _>(practice)
            .execute(conn)
        })?;

        Ok(())
    }

    pub fn create(conn: &mut PgConnection, record: &NewUserPractice) -> Result<(), AppError> {
        diesel::insert_into(user_practices::table)
            .values(record)
            .execute(conn)?;
        Ok(())
    }
}

/// Retrieves all user practices
pub async fn get_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    let res = UserPractice::all_user_practices(&mut conn, &user_id)?;
    Ok(HttpResponse::Ok().json(AllUserPracticesResponse::from(res)))
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

type PracticeSlug = String;

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

    UserPractice::delete(&mut conn, &user_id, &practice)?;

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

    UserPractice::update(
        &mut conn,
        &user_id,
        &practice,
        &form.user_practice.practice,
        form.user_practice.is_active,
    )?;

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
    };
    UserPractice::create(&mut conn, &record)?;
    Ok(HttpResponse::Ok().json(()))
}

#[derive(Debug, Insertable)]
#[diesel(table_name=user_practices)]
pub struct NewUserPractice {
    user_id: Uuid,
    practice: String,
    data_type: PracticeDataType,
    is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct NewUserPracticeRequest {
    user_practice: UserPractice,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserPracticeRequest {
    user_practice: UserPractice,
}
