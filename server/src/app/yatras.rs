use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use common::error::AppError;
use diesel::{dsl::sql, prelude::*, sql_query, sql_types::Uuid as DieselUuid, sql_types::*};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use urlencoding::decode;
use uuid::Uuid;

use crate::{
    db_types::PracticeDataType,
    middleware::{auth, state::AppState},
    schema::{
        sql_types::PracticeDataTypeEnum, user_practices, yatra_practices, yatra_user_practices,
        yatra_users, yatras,
    },
};

#[derive(Serialize, Debug, Queryable)]
#[diesel(table_name = yatras)]
pub struct Yatra {
    pub id: Uuid,
    pub name: String,
}

impl Yatra {
    pub fn join(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
        diesel::insert_into(yatra_users::table)
            .values((
                yatra_users::yatra_id.eq(&yatra_id),
                yatra_users::user_id.eq(&user_id),
                yatra_users::is_admin.eq(false),
            ))
            .execute(conn)?;
        Ok(())
    }

    pub fn leave(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
        let admins_qty: i64 = yatra_users::table
            .select(diesel::dsl::count_star())
            .filter(
                yatra_users::yatra_id
                    .eq(&yatra_id)
                    .and(yatra_users::user_id.ne(&user_id))
                    .and(yatra_users::is_admin.eq(true)),
            )
            .first(conn)?;

        if admins_qty == 0 {
            return Err(AppError::UnprocessableEntity(vec![
                "Can't delete last yatra admin".into(),
            ]));
        }

        conn.transaction(|conn| {
            sql_query(
                r#"
                delete from yatra_user_practices yup
                where yup.yatra_practice_id in (
                    select yp.id from yatra_practices yp where yp.yatra_id = $1
                )
                and yup.user_practice_id in (
                    select up.id from user_practices up where up.user_id = $2
                )
                "#,
            )
            .bind::<DieselUuid, _>(&yatra_id)
            .bind::<DieselUuid, _>(&user_id)
            .execute(conn)?;

            diesel::delete(yatra_users::table)
                .filter(
                    yatra_users::yatra_id
                        .eq(&yatra_id)
                        .and(yatra_users::user_id.eq(&user_id)),
                )
                .execute(conn)
        })?;

        Ok(())
    }

    pub fn is_admin(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<bool, AppError> {
        let cnt: i64 = yatra_users::table
            .select(diesel::dsl::count_star())
            .filter(
                yatra_users::is_admin
                    .eq(true)
                    .and(yatra_users::user_id.eq(&user_id))
                    .and(yatra_users::yatra_id.eq(&yatra_id)),
            )
            .first(conn)?;

        Ok(cnt > 0)
    }

    pub fn get_yatra(conn: &mut PgConnection, yatra_id: &Uuid) -> Result<Self, AppError> {
        let res = yatras::table
            .select((yatras::id, yatras::name))
            .filter(yatras::id.eq(&yatra_id))
            .first(conn)?;
        Ok(res)
    }

    fn ensure_admin_user(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<(), AppError> {
        let res = Self::is_admin(conn, user_id, yatra_id)?;

        if res {
            Ok(())
        } else {
            Err(AppError::Unauthorized(format!(
                "User {} is not authorized to alter yatra {}",
                user_id, yatra_id
            )))
        }
    }

    pub fn create(conn: &mut PgConnection, name: String, user_id: &Uuid) -> Result<Self, AppError> {
        let id = conn.transaction(|conn| {
            let id = diesel::insert_into(yatras::table)
                .values(yatras::name.eq(&name))
                .returning(yatras::id)
                .get_result(conn)?;

            diesel::insert_into(yatra_users::table)
                .values((
                    yatra_users::yatra_id.eq(&id),
                    yatra_users::user_id.eq(&user_id),
                    yatra_users::is_admin.eq(true),
                ))
                .execute(conn)?;

            Ok::<_, diesel::result::Error>(id)
        })?;

        Ok(Yatra { id, name })
    }

    pub fn delete(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, yatra_id)?;

        conn.transaction(|conn| {
            YatraPractice::delete_int(conn, yatra_id, None)?;
            diesel::delete(yatra_users::table)
                .filter(yatra_users::yatra_id.eq(&yatra_id))
                .execute(conn)?;
            diesel::delete(yatras::table)
                .filter(yatras::id.eq(&yatra_id))
                .execute(conn)
        })?;

        Ok(())
    }

    pub fn rename(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        new_name: &str,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, yatra_id)?;

        diesel::update(yatras::table)
            .set(yatras::name.eq(&new_name))
            .filter(yatras::id.eq(&yatra_id))
            .execute(conn)?;

        Ok(())
    }

    pub fn get_user_yatras(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<Self>, AppError> {
        let res = yatras::table
            .inner_join(yatra_users::table)
            .filter(yatra_users::user_id.eq(&user_id))
            .select((yatras::id, yatras::name))
            .order_by(yatras::name)
            .load(conn)?;

        Ok(res)
    }
}

#[derive(Debug, Queryable, Serialize)]
#[diesel(table_name = yatra_practices)]
pub struct NewYatraPractice {
    pub yatra_id: Uuid,
    pub practice: String,
    pub data_type: PracticeDataType,
}

#[derive(Debug, Queryable, Serialize, Deserialize, Clone)]
#[diesel(table_name = yatra_practices)]
pub struct YatraPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
}

impl YatraPractice {
    pub fn create(
        conn: &mut PgConnection,
        user_id: &Uuid,
        record: &NewYatraPractice,
    ) -> Result<(), AppError> {
        use crate::schema::yatra_practices::dsl::*;

        Yatra::ensure_admin_user(conn, &user_id, &record.yatra_id)?;

        let subq = yatra_practices
            .filter(yatra_id.eq(&record.yatra_id))
            .select((
                // diesel::dsl::count_star() is BigInt which needs down-casting
                sql::<Int4>("cast(count(*) as integer)"),
                record.yatra_id.into_sql::<DieselUuid>(),
                (&record.practice).into_sql::<Text>(),
                (&record.data_type).into_sql::<PracticeDataTypeEnum>(),
            ));

        diesel::insert_into(yatra_practices)
            .values(subq)
            .into_columns((order_key, yatra_id, practice, data_type))
            .execute(conn)?;

        Ok(())
    }

    pub fn update(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        practice: &str,
        update: &YatraPracticeUpdate,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, &user_id, &yatra_id)?;

        diesel::update(yatra_practices::table)
            .set(yatra_practices::practice.eq(&update.practice))
            .filter(yatra_practices::practice.eq(practice))
            .execute(conn)?;

        Ok(())
    }

    fn delete_int(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
        yatra_practice: Option<&str>,
    ) -> Result<(), diesel::result::Error> {
        let mut yatra_practice_filter = yatra_practices::table
            .select(yatra_practices::id)
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .into_boxed();

        let mut del2 = diesel::delete(yatra_practices::table)
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .into_boxed();

        if let Some(practice) = yatra_practice {
            yatra_practice_filter =
                yatra_practice_filter.filter(yatra_practices::practice.eq(practice));
            del2 = del2.filter(yatra_practices::practice.eq(practice));
        }

        diesel::delete(yatra_user_practices::table)
            .filter(yatra_user_practices::yatra_practice_id.eq_any(yatra_practice_filter))
            .execute(conn)?;

        del2.execute(conn)?;

        Ok(())
    }

    pub fn delete(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        practice: &str,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, &user_id, &yatra_id)?;

        conn.transaction(|conn| Self::delete_int(conn, yatra_id, Some(practice)))?;

        Ok(())
    }

    pub fn get_ordered_yatra_practices(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = yatra_practices::table
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .select((yatra_practices::practice, yatra_practices::data_type))
            .order_by(yatra_practices::order_key)
            .load(conn)?;

        Ok(res)
    }

    pub fn update_order_key(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        data: &Vec<UpdateYatraPracticeOrderKey>,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, &user_id, &yatra_id)?;

        conn.transaction(|conn| {
            for row in data {
                diesel::update(yatra_practices::table)
                    .set(yatra_practices::order_key.eq(row.order_key))
                    .filter(
                        yatra_practices::yatra_id
                            .eq(&yatra_id)
                            .and(yatra_practices::practice.eq(&row.practice)),
                    )
                    .execute(conn)?;
            }
            Ok(())
        })
    }
}

#[derive(Debug, QueryableByName)]
struct YatraUserPracticeFlat {
    #[diesel(sql_type = Text)]
    yatra_practice: String,
    #[diesel(sql_type = PracticeDataTypeEnum)]
    data_type: PracticeDataType,
    #[diesel(sql_type = Nullable<Text>)]
    user_practice: Option<String>,
}

#[derive(Debug, Queryable, Serialize, Deserialize, Clone)]
#[diesel(table_name = yatra_practices)]
pub struct YatraUserPractice {
    pub yatra_practice: YatraPractice,
    pub user_practice: Option<String>,
}

impl YatraUserPractice {
    pub fn update_yatra_user_practices(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        data: &Vec<Self>,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            diesel::delete(yatra_user_practices::table)
                .filter(
                    yatra_user_practices::yatra_practice_id
                        .eq_any(
                            yatra_practices::table
                                .select(yatra_practices::id)
                                .filter(yatra_practices::yatra_id.eq(&yatra_id)),
                        )
                        .and(
                            yatra_user_practices::user_practice_id.eq_any(
                                user_practices::table
                                    .select(user_practices::id)
                                    .filter(user_practices::user_id.eq(&user_id)),
                            ),
                        ),
                )
                .execute(conn)?;

            for yp in data {
                if let Some(up) = yp.user_practice.as_ref() {
                    sql_query(
                        r#"
                    insert into yatra_user_practices (yatra_practice_id, user_practice_id)
                    select yp.id, up.id
                    from   yatra_practices yp
                    cross join user_practices up
                    where  yp.yatra_id = $1
                    and    yp.practice = $2
                    and    up.user_id = $3
                    and    up.practice = $4
                    "#,
                    )
                    .bind::<DieselUuid, _>(&yatra_id)
                    .bind::<Text, _>(&yp.yatra_practice.practice)
                    .bind::<DieselUuid, _>(&user_id)
                    .bind::<Text, _>(up)
                    .execute(conn)?;
                }
            }

            Ok::<_, diesel::result::Error>(())
        })?;

        Ok(())
    }

    pub fn get_yatra_user_practices(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = sql_query(
            r#"
            with p as (
                select
                    up.practice as user_practice,
                    yup.yatra_practice_id
                from
                    yatra_user_practices yup
                    join user_practices up on (
                        up.id = yup.user_practice_id
                        and up.user_id = $2
                    )
            )
            SELECT
                yp.practice as yatra_practice,
                yp.data_type,
                p.user_practice
            FROM
                yatra_practices yp
                LEFT join p on (p.yatra_practice_id = yp.id)
            where
                yp.yatra_id = $1
            ORDER BY
                yp.order_key
            "#,
        )
        .bind::<DieselUuid, _>(&yatra_id)
        .bind::<DieselUuid, _>(&user_id)
        .load::<YatraUserPracticeFlat>(conn)?;

        Ok(res
            .into_iter()
            .map(
                |YatraUserPracticeFlat {
                     yatra_practice,
                     data_type,
                     user_practice,
                 }| YatraUserPractice {
                    yatra_practice: YatraPractice {
                        practice: yatra_practice,
                        data_type,
                    },
                    user_practice,
                },
            )
            .collect())
    }
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct YatraDataRow {
    #[diesel(sql_type = Text)]
    pub user_name: String,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub value: Option<JsonValue>,
}

impl YatraDataRow {
    pub fn get_yatra_data(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
        cob_date: &NaiveDate,
    ) -> Result<Vec<Self>, AppError> {
        let data = sql_query(
            r#"
            with d as (
                select
                    yup.yatra_practice_id,
                    d.value,
                    d.user_id
                from
                    diary d
                    join yatra_user_practices yup on (yup.user_practice_id = d.practice_id)
                where
                    d.cob_date = $2
            )
            select
                u."name" as user_name,
                d.value
            from
                yatra_users yu
                join users u on (u.id = yu.user_id)
                join yatra_practices yp on (yp.yatra_id = yu.yatra_id)
                left join d on (
                    d.yatra_practice_id = yp.id
                    and d.user_id = u.id
                )
            where
                yu.yatra_id = $1
            order by
                1,
                yp.order_key
            "#,
        )
        .bind::<DieselUuid, _>(yatra_id)
        .bind::<Date, _>(cob_date)
        .load::<Self>(conn)?;

        Ok(data)
    }
}

/// Gets yatra data for a cob date
pub async fn yatra_data(
    state: web::Data<AppState>,
    params: web::Query<YatraDataQueryParams>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let cob_date = params.cob_date;
    let yatra_id = path.into_inner();

    let data =
        web::block(move || YatraDataRow::get_yatra_data(&mut conn, &yatra_id, &cob_date)).await??;

    let mut conn = state.get_conn()?;

    let practices =
        web::block(move || YatraPractice::get_ordered_yatra_practices(&mut conn, &yatra_id))
            .await??;

    Ok(HttpResponse::Ok().json(YatraDataResponse::from((practices, data))))
}

pub async fn is_admin(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    let res = web::block(move || Yatra::is_admin(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(YatraIsAdminResponse { is_admin: res }))
}

pub async fn join_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || Yatra::join(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

pub async fn leave_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || Yatra::leave(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Gets all user yatras
pub async fn user_yatras(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatras = web::block(move || Yatra::get_user_yatras(&mut conn, &user_id)).await??;

    Ok(HttpResponse::Ok().json(YatrasResponse { yatras }))
}

/// Create a new yatra
pub async fn create_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<CreateYatraForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let name = form.name.clone();
    let user_id = auth::get_current_user(&req)?.id;

    let yatra = web::block(move || Yatra::create(&mut conn, name, &user_id)).await??;

    Ok(HttpResponse::Ok().json(YatraResponse { yatra }))
}

/// Delete yatra
pub async fn delete_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    web::block(move || Yatra::delete(&mut conn, &user_id, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Rename yatra
pub async fn rename_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
    form: web::Json<RenameYatraForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    web::block(move || Yatra::rename(&mut conn, &user_id, &yatra_id, &form.name)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra
pub async fn get_yatra(
    state: web::Data<AppState>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let yatra = web::block(move || Yatra::get_yatra(&mut conn, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(YatraResponse { yatra }))
}

/// Get yatra practices
pub async fn get_yatra_practices(
    state: web::Data<AppState>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let practices =
        web::block(move || YatraPractice::get_ordered_yatra_practices(&mut conn, &yatra_id))
            .await??;

    Ok(HttpResponse::Ok().json(YatraPracticesResponse { practices }))
}

/// Create yatra practice
pub async fn create_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<CreateYatraPracticeForm>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    let data = NewYatraPractice {
        yatra_id,
        practice: form.practice.practice.clone(),
        data_type: form.practice.data_type.clone(),
    };

    web::block(move || YatraPractice::create(&mut conn, &user_id, &data)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Delete yatra practice
pub async fn delete_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, practice) = path.into_inner();
    let practice = decode(&practice)?.into_owned();

    web::block(move || YatraPractice::delete(&mut conn, &user_id, &yatra_id, &practice)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Update yatra practice
pub async fn update_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<UpdateYatraPracticeForm>,
    path: web::Path<YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, practice) = path.into_inner();
    let data = form.update.clone();
    let practice = decode(&practice)?.into_owned();

    web::block(move || YatraPractice::update(&mut conn, &user_id, &yatra_id, &practice, &data))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Updates order of yatra practices
pub async fn update_yatra_practice_order_key(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
    form: web::Json<UpdateYatraPracticeOrderKeyRequest>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra_id = path.into_inner();

    let data = form
        .practices
        .iter()
        .enumerate()
        .map(|(idx, practice)| UpdateYatraPracticeOrderKey {
            practice: practice.clone(),
            order_key: idx as i32,
        })
        .collect();

    web::block(move || YatraPractice::update_order_key(&mut conn, &user_id, &yatra_id, &data))
        .await??;
    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra to user practices mapping
pub async fn get_yatra_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;

    let practices = web::block(move || {
        YatraUserPractice::get_yatra_user_practices(&mut conn, &user_id, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(YatraUserPractices { practices }))
}

/// Update yatra to user practices mapping
pub async fn update_yatra_user_practices(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdSlug>,
    form: web::Json<YatraUserPractices>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();
    let user_id = auth::get_current_user(&req)?.id;
    let data = form.practices.clone();

    web::block(move || {
        YatraUserPractice::update_yatra_user_practices(&mut conn, &user_id, &yatra_id, &data)
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

type YatraIdSlug = Uuid;
type YatraIdPracticeSlug = (Uuid, String);

#[derive(Deserialize, Debug)]
pub struct YatraDataQueryParams {
    cob_date: NaiveDate,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraForm {
    name: String,
}

#[derive(Deserialize, Debug)]
pub struct RenameYatraForm {
    name: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraPracticeForm {
    practice: YatraPractice,
}

#[derive(Deserialize, Debug, Clone)]
pub struct YatraPracticeUpdate {
    practice: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateYatraPracticeForm {
    update: YatraPracticeUpdate,
}

#[derive(Debug, Deserialize)]
pub struct UpdateYatraPracticeOrderKeyRequest {
    practices: Vec<String>,
}

#[derive(Debug)]
pub struct UpdateYatraPracticeOrderKey {
    pub practice: String,
    pub order_key: i32,
}

#[derive(Serialize, Debug)]
pub struct YatraIsAdminResponse {
    pub is_admin: bool,
}

#[derive(Serialize, Debug)]
pub struct YatraDataResponse {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<(String, Vec<Option<JsonValue>>)>,
}

impl From<(Vec<YatraPractice>, Vec<YatraDataRow>)> for YatraDataResponse {
    fn from(value: (Vec<YatraPractice>, Vec<YatraDataRow>)) -> Self {
        let (ps, rows) = value;

        // Note, assumes data comes in sorted by user and then practice order key
        let mut curr_user = None;
        let mut curr_user_data = vec![];
        let mut all_users_data = vec![];
        for row in rows.into_iter() {
            if let Some(user) = curr_user.take() {
                if user == row.user_name {
                    curr_user_data.push(row.value);
                } else {
                    all_users_data.push((user, curr_user_data));
                    curr_user_data = vec![row.value];
                }
                curr_user = Some(row.user_name);
            } else {
                curr_user = Some(row.user_name);
                curr_user_data = vec![row.value];
            }
        }

        if let Some(user) = curr_user.take() {
            all_users_data.push((user, curr_user_data));
        }

        Self {
            practices: ps,
            data: all_users_data,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct YatrasResponse {
    pub yatras: Vec<Yatra>,
}

#[derive(Serialize, Debug)]
pub struct YatraResponse {
    pub yatra: Yatra,
}

#[derive(Serialize, Debug)]
pub struct YatraPracticesResponse {
    pub practices: Vec<YatraPractice>,
}

#[derive(Serialize, Debug, Deserialize)]
pub struct YatraUserPractices {
    pub practices: Vec<YatraUserPractice>,
}
