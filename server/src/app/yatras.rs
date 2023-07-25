use actix_web::{web, HttpRequest, HttpResponse};
use chrono::NaiveDate;
use common::error::AppError;
use diesel::{prelude::*, sql_query, sql_types::Uuid as DieselUuid, sql_types::*};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::{
    db_types::PracticeDataType,
    middleware::{auth, state::AppState},
    schema::{yatra_practices, yatra_users, yatras},
};

#[derive(Serialize, Debug, Queryable)]
#[diesel(table_name = yatras)]
pub struct Yatra {
    pub id: Uuid,
    pub name: String,
}

impl Yatra {
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
                ))
                .execute(conn)?;

            Ok::<_, diesel::result::Error>(id)
        })?;

        Ok(Yatra { id, name })
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
pub struct YatraPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
}

impl YatraPractice {
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

    Ok(HttpResponse::Ok().json(CreateYatraResponse { yatra }))
}

type YatraIdSlug = Uuid;

#[derive(Deserialize, Debug)]
pub struct YatraDataQueryParams {
    cob_date: NaiveDate,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraForm {
    name: String,
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
pub struct CreateYatraResponse {
    pub yatra: Yatra,
}
