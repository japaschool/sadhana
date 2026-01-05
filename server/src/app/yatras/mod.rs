use std::collections::HashMap;

use actix_web::{HttpRequest, HttpResponse, web};
use chrono::{Days, NaiveDate};
use common::error::AppError;
use diesel::{
    dsl::{self, sql},
    prelude::*,
    sql_query,
    sql_types::{Uuid as DieselUuid, *},
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::{
    db_types::PracticeDataType,
    middleware::{auth, state::AppState},
    schema::{
        sql_types::PracticeDataTypeEnum, user_practices, users, yatra_practices,
        yatra_user_practices, yatra_users, yatras,
    },
    utils::date::*,
};

#[derive(Serialize, Deserialize, Debug, Queryable, Selectable)]
#[diesel(table_name = yatras)]
pub struct Yatra {
    pub id: Uuid,
    pub name: String,
    pub statistics: Option<JsonValue>,
}

impl Yatra {
    fn join(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
        diesel::insert_into(yatra_users::table)
            .values((
                yatra_users::yatra_id.eq(&yatra_id),
                yatra_users::user_id.eq(&user_id),
                yatra_users::is_admin.eq(false),
            ))
            .execute(conn)?;
        Ok(())
    }

    fn ensure_has_other_admins(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<(), AppError> {
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

        Ok(())
    }

    fn leave(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
        Self::ensure_has_other_admins(conn, user_id, yatra_id)?;

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

    fn is_admin(
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

    fn toggle_is_admin(
        conn: &mut PgConnection,
        current_user_id: &Uuid,
        user_id: &Uuid,
        yatra_id: &Uuid,
    ) -> Result<(), AppError> {
        Self::ensure_admin_user(conn, current_user_id, yatra_id)?;
        Self::ensure_has_other_admins(conn, user_id, yatra_id)?;

        diesel::update(yatra_users::table)
            .set(yatra_users::is_admin.eq(dsl::not(yatra_users::is_admin)))
            .filter(
                yatra_users::yatra_id
                    .eq(&yatra_id)
                    .and(yatra_users::user_id.eq(&user_id)),
            )
            .execute(conn)?;
        Ok(())
    }

    fn get_yatra(conn: &mut PgConnection, yatra_id: &Uuid) -> Result<Self, AppError> {
        let res = yatras::table
            .select(Yatra::as_select())
            .filter(yatras::id.eq(&yatra_id))
            .first(conn)?;
        Ok(res)
    }

    fn get_yatra_stats(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
    ) -> Result<Option<YatraStatistics>, AppError> {
        let yatra = Self::get_yatra(conn, yatra_id)?;
        let res = match yatra.statistics {
            Some(stats_json) => {
                let stats: YatraStatistics = serde_json::from_value(stats_json)?;
                Some(stats)
            }
            None => None,
        };
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
            Err(AppError::Forbidden(format!(
                "User {} is not allowed to alter yatra {}",
                user_id, yatra_id
            )))
        }
    }

    fn create(conn: &mut PgConnection, name: String, user_id: &Uuid) -> Result<Self, AppError> {
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

        Ok(Yatra {
            id,
            name,
            statistics: None,
        })
    }

    fn delete(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
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

    fn update(&self, conn: &mut PgConnection, user_id: &Uuid) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, &self.id)?;

        diesel::update(yatras::table.find(&self.id))
            .set((
                yatras::name.eq(&self.name),
                yatras::statistics.eq(&self.statistics),
            ))
            .execute(conn)?;

        Ok(())
    }

    fn get_user_yatras(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<Self>, AppError> {
        let res = yatras::table
            .inner_join(yatra_users::table)
            .filter(yatra_users::user_id.eq(&user_id))
            .select(Yatra::as_select())
            .order_by(yatras::name)
            .load(conn)?;

        Ok(res)
    }
}

#[derive(Debug, Queryable, Deserialize)]
#[diesel(table_name = yatra_practices)]
pub struct NewYatraPractice {
    pub yatra_id: Uuid,
    pub practice: String,
    pub data_type: PracticeDataType,
}

#[derive(Debug, Queryable, Selectable, Serialize, Deserialize, Clone)]
#[diesel(table_name = yatra_practices)]
pub struct YatraPractice {
    pub id: Uuid,
    pub practice: String,
    pub data_type: PracticeDataType,
    pub colour_zones: Option<JsonValue>,
}

impl YatraPractice {
    pub fn create(
        conn: &mut PgConnection,
        user_id: &Uuid,
        record: &NewYatraPractice,
    ) -> Result<(), AppError> {
        use crate::schema::yatra_practices::dsl::*;

        Yatra::ensure_admin_user(conn, user_id, &record.yatra_id)?;

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
        practice: &YatraPractice,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, yatra_id)?;

        diesel::update(yatra_practices::table.find(practice.id))
            .set((
                yatra_practices::practice.eq(&practice.practice),
                yatra_practices::colour_zones.eq(&practice.colour_zones),
            ))
            .execute(conn)?;

        Ok(())
    }

    fn delete_int(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
        yatra_practice_id: Option<&Uuid>,
    ) -> Result<(), diesel::result::Error> {
        let mut yatra_practice_filter = yatra_practices::table
            .select(yatra_practices::id)
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .into_boxed();

        let mut del2 = diesel::delete(yatra_practices::table)
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .into_boxed();

        if let Some(practice_id) = yatra_practice_id {
            yatra_practice_filter =
                yatra_practice_filter.filter(yatra_practices::id.eq(practice_id));
            del2 = del2.filter(yatra_practices::id.eq(practice_id));
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
        practice_id: &Uuid,
    ) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, yatra_id)?;

        conn.transaction(|conn| Self::delete_int(conn, yatra_id, Some(practice_id)))?;

        Ok(())
    }

    pub fn get_ordered_yatra_practices(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = yatra_practices::table
            .filter(yatra_practices::yatra_id.eq(&yatra_id))
            .select(YatraPractice::as_select())
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
        Yatra::ensure_admin_user(conn, user_id, yatra_id)?;

        conn.transaction(|conn| {
            for row in data {
                diesel::update(yatra_practices::table)
                    .set(yatra_practices::order_key.eq(row.order_key))
                    .filter(
                        yatra_practices::yatra_id
                            .eq(&yatra_id)
                            .and(yatra_practices::id.eq(&row.practice_id)),
                    )
                    .execute(conn)?;
            }
            Ok(())
        })
    }

    pub fn get(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
        practice_id: &Uuid,
    ) -> Result<Self, AppError> {
        let res = yatra_practices::table
            .filter(
                yatra_practices::yatra_id
                    .eq(&yatra_id)
                    .and(yatra_practices::id.eq(&practice_id)),
            )
            .select(Self::as_select())
            .first(conn)?;

        Ok(res)
    }
}

#[derive(Debug, Queryable, Serialize, Clone)]
pub struct YatraUser {
    pub user_id: Uuid,
    pub user_name: String,
    pub is_admin: bool,
}

impl YatraUser {
    pub fn get_yatra_users(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = yatra_users::table
            .inner_join(users::table)
            .filter(yatra_users::yatra_id.eq(&yatra_id))
            .select((users::id, users::name, yatra_users::is_admin))
            .order_by(users::name)
            .load(conn)?;

        Ok(res)
    }
}

#[derive(Debug, QueryableByName)]
struct YatraUserPracticeFlat {
    #[diesel(sql_type = DieselUuid)]
    yatra_practice_id: Uuid,
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
                yp.id as yatra_practice_id,
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
                     yatra_practice_id,
                     yatra_practice,
                     data_type,
                     user_practice,
                 }| YatraUserPractice {
                    yatra_practice: YatraPractice {
                        id: yatra_practice_id,
                        practice: yatra_practice,
                        data_type,
                        colour_zones: None,
                    },
                    user_practice,
                },
            )
            .collect())
    }
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct YatraDataRow {
    #[diesel(sql_type = DieselUuid)]
    pub user_id: Uuid,
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
                u.id as user_id,
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

#[derive(Deserialize, Debug)]
enum Aggregation {
    Sum,
    Avg,
    Min,
    Max,
    Count,
}

#[derive(Deserialize, Debug)]
enum TimeRange {
    Last7Days,
    Last30Days,
    Last90Days,
    Last365Days,
    ThisWeek,
    ThisMonth,
    ThisQuarter,
    ThisYear,
}

impl TimeRange {
    fn to_naive_date(&self, relative_to: &NaiveDate) -> NaiveDate {
        match self {
            Self::Last7Days => relative_to.checked_sub_days(Days::new(7)).unwrap(),
            Self::Last30Days => relative_to.checked_sub_days(Days::new(30)).unwrap(),
            Self::Last90Days => relative_to.checked_sub_days(Days::new(90)).unwrap(),
            Self::Last365Days => relative_to.checked_sub_days(Days::new(365)).unwrap(),
            Self::ThisWeek => relative_to.start_of_week(),
            Self::ThisMonth => relative_to.start_of_month(),
            Self::ThisQuarter => relative_to.start_of_quarter(),
            Self::ThisYear => relative_to.start_of_year(),
        }
    }
}

#[derive(Deserialize, Debug)]
struct YatraStatistic {
    label: String,
    practice_id: Uuid,
    aggregation: Aggregation,
    time_range: TimeRange,
}

#[derive(Deserialize, Debug)]
struct YatraStatistics {
    visible_to_all: bool,
    statistics: Vec<YatraStatistic>,
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct YatraStatisticResult {
    #[diesel(sql_type = Text)]
    pub label: String,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub value: Option<JsonValue>,
}

impl YatraStatisticResult {
    pub fn get_stats(
        conn: &mut PgConnection,
        user_id: &Uuid,
        yatra_id: &Uuid,
        cob_date: &NaiveDate,
    ) -> Result<Vec<Self>, AppError> {
        let is_admin = Yatra::is_admin(conn, user_id, yatra_id)?;
        let stats_conf = Yatra::get_yatra_stats(conn, yatra_id)?;

        if stats_conf
            .as_ref()
            .is_none_or(|conf| !(conf.visible_to_all || is_admin))
        {
            return Ok(vec![]);
        }

        let practice_types: HashMap<_, _> =
            YatraPractice::get_ordered_yatra_practices(conn, yatra_id)?
                .iter()
                .map(|p| (p.id, p.data_type.to_owned()))
                .collect();

        stats_conf
            .unwrap()
            .statistics
            .into_iter()
            .map(|stat| {
                let from_cob = stat.time_range.to_naive_date(cob_date);
                let data_type = practice_types.get(&stat.practice_id).unwrap();
                let sql = Self::stat_sql(data_type, &stat.aggregation);

                log::debug!(
                    "Yatra statistic SQL from {} to {} for practice {}:\n{}",
                    from_cob,
                    cob_date,
                    stat.practice_id,
                    sql
                );

                let res = sql_query(&sql)
                    .bind::<Text, _>(stat.label)
                    .bind::<DieselUuid, _>(stat.practice_id)
                    .bind::<Date, _>(from_cob)
                    .bind::<Date, _>(cob_date)
                    .get_result::<Self>(conn)?;

                Ok(res)
            })
            .collect()
    }

    fn stat_sql(data_type: &PracticeDataType, agg: &Aggregation) -> String {
        let value_exp = match data_type {
            PracticeDataType::Int => "(value->>'Int')::int",
            PracticeDataType::Time => {
                "(value->'Time'->>'h')::int * 60 + (value->'Time'->>'m')::int"
            }
            PracticeDataType::Duration => "(value->>'Duration')::int",
            _ => "",
        };

        let aggregated_value_exp = match agg {
            Aggregation::Sum => format!("sum({value_exp})"),
            Aggregation::Avg => format!("avg({value_exp})"),
            Aggregation::Min => format!("min({value_exp})"),
            Aggregation::Max => format!("max({value_exp})"),
            Aggregation::Count => "count(*)".to_string(),
        };

        let aggregated_json_value_exp = match data_type {
            PracticeDataType::Time => format!(
                "jsonb_build_object('Time', jsonb_build_object('h', ({}) / 60, 'm', ({}) % 60))",
                aggregated_value_exp, aggregated_value_exp
            ),
            PracticeDataType::Duration => {
                format!("jsonb_build_object('Duration', ({aggregated_value_exp}))")
            }
            _ => format!("jsonb_build_object('Int', ({aggregated_value_exp}))"),
        };

        format!(
            r#"
                select
                    $1 as label,
                    case
                        when {} is null
                        then null
                        else {}
                    end as value
                from   diary d
                where  d.practice_id in (
                    select p.user_practice_id
                    from   yatra_user_practices p
                    where  p.yatra_practice_id = $2
                )
                and    d.cob_date >= $3
                and    d.cob_date <= $4
                and    d.value is not null
                "#,
            aggregated_value_exp, aggregated_json_value_exp
        )
    }
}

/// Gets yatra data for a cob date
pub async fn yatra_data(
    state: web::Data<AppState>,
    req: HttpRequest,
    params: web::Query<YatraDataQueryParams>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let cob_date = params.cob_date;
    let yatra_id = path.into_inner();

    let res = web::block(move || {
        match (
            YatraPractice::get_ordered_yatra_practices(&mut conn, &yatra_id),
            YatraDataRow::get_yatra_data(&mut conn, &yatra_id, &cob_date),
            YatraStatisticResult::get_stats(&mut conn, &user_id, &yatra_id, &cob_date),
        ) {
            (Ok(data), Ok(practices), Ok(stats)) => Ok((data, practices, stats)),
            (Err(e), _, _) | (_, Err(e), _) | (_, _, Err(e)) => {
                log::warn!("Failed to retrieve yatra data: {e}");
                Err(e)
            }
        }
    })
    .await??;

    log::debug!("Yatra data: {:?}", res);

    Ok(HttpResponse::Ok().json(YatraDataResponse::from(res)))
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

pub async fn yatra_leave(
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
pub async fn update_yatra(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<UpdateYatraForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let yatra = form.into_inner().yatra;

    web::block(move || yatra.update(&mut conn, &user_id)).await??;

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

/// Get yatra users
pub async fn get_yatra_users(
    state: web::Data<AppState>,
    path: web::Path<YatraIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let yatra_id = path.into_inner();

    let users = web::block(move || YatraUser::get_yatra_users(&mut conn, &yatra_id)).await??;

    Ok(HttpResponse::Ok().json(YatraUsersResponse { users }))
}

/// Get yatra users
pub async fn delete_yatra_user(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdUserIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, user_id) = path.into_inner();
    let current_user_id = auth::get_current_user(&req)?.id;

    web::block(move || {
        Yatra::ensure_admin_user(&mut conn, &current_user_id, &yatra_id)?;
        Yatra::leave(&mut conn, &user_id, &yatra_id)
    })
    .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra users
pub async fn toggle_is_admin(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdUserIdSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, user_id) = path.into_inner();
    let current_user_id = auth::get_current_user(&req)?.id;

    web::block(move || Yatra::toggle_is_admin(&mut conn, &current_user_id, &user_id, &yatra_id))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Create yatra practice
pub async fn create_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<CreateYatraPracticeForm>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;

    web::block(move || YatraPractice::create(&mut conn, &user_id, &form.practice)).await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Get yatra practice details
pub async fn get_yatra_practice(
    state: web::Data<AppState>,
    path: web::Path<YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let (yatra_id, practice_id) = path.into_inner();

    let practice =
        web::block(move || YatraPractice::get(&mut conn, &yatra_id, &practice_id)).await??;

    Ok(HttpResponse::Ok().json(GetYatraPracticeResponse { practice }))
}

/// Delete yatra practice
pub async fn delete_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, practice_id) = path.into_inner();

    web::block(move || YatraPractice::delete(&mut conn, &user_id, &yatra_id, &practice_id))
        .await??;

    Ok(HttpResponse::Ok().json(()))
}

/// Update yatra practice
pub async fn update_yatra_practice(
    state: web::Data<AppState>,
    req: HttpRequest,
    form: web::Json<UpdateYatraPractice>,
    path: web::Path<YatraIdPracticeSlug>,
) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let user_id = auth::get_current_user(&req)?.id;
    let (yatra_id, _) = path.into_inner();
    let data = form.practice.clone();

    web::block(move || YatraPractice::update(&mut conn, &user_id, &yatra_id, &data)).await??;

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

    log::info!("Reorder payload {:?}", form.practices);

    let data = form
        .practices
        .iter()
        .enumerate()
        .map(|(idx, practice)| UpdateYatraPracticeOrderKey {
            practice_id: *practice,
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
type YatraIdPracticeSlug = (Uuid, Uuid);
type YatraIdUserIdSlug = (Uuid, Uuid);

#[derive(Deserialize, Debug)]
pub struct YatraDataQueryParams {
    cob_date: NaiveDate,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraForm {
    name: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateYatraForm {
    yatra: Yatra,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraPracticeForm {
    practice: NewYatraPractice,
}

#[derive(Deserialize, Debug)]
pub struct UpdateYatraPractice {
    practice: YatraPractice,
}

#[derive(Debug, Deserialize)]
pub struct UpdateYatraPracticeOrderKeyRequest {
    practices: Vec<Uuid>,
}

#[derive(Debug)]
pub struct UpdateYatraPracticeOrderKey {
    pub practice_id: Uuid,
    pub order_key: i32,
}

#[derive(Serialize, Debug)]
pub struct YatraIsAdminResponse {
    pub is_admin: bool,
}

#[derive(Serialize, Debug)]
pub struct YatraDataRowResponse {
    pub user_id: Uuid,
    pub user_name: String,
    pub row: Vec<Option<JsonValue>>,
}

impl YatraDataRowResponse {
    fn new(user_id: Uuid, user_name: String, row: Vec<Option<JsonValue>>) -> Self {
        Self {
            user_id,
            user_name,
            row,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct YatraDataResponse {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<YatraDataRowResponse>,
    pub statistics: Vec<YatraStatisticResult>,
}

impl
    From<(
        Vec<YatraPractice>,
        Vec<YatraDataRow>,
        Vec<YatraStatisticResult>,
    )> for YatraDataResponse
{
    fn from(
        value: (
            Vec<YatraPractice>,
            Vec<YatraDataRow>,
            Vec<YatraStatisticResult>,
        ),
    ) -> Self {
        let (practices, rows, statistics) = value;

        // Note, assumes data comes in sorted by user and then practice order key
        let mut curr_user = None;
        let mut curr_user_data = vec![];
        let mut all_users_data = vec![];
        for row in rows.into_iter() {
            if let Some((user_id, user_name)) = curr_user.take() {
                if user_id == row.user_id {
                    curr_user_data.push(row.value);
                } else {
                    all_users_data.push(YatraDataRowResponse::new(
                        user_id,
                        user_name,
                        curr_user_data,
                    ));
                    curr_user_data = vec![row.value];
                }
                curr_user = Some((row.user_id, row.user_name));
            } else {
                curr_user = Some((row.user_id, row.user_name));
                curr_user_data = vec![row.value];
            }
        }

        if let Some((user_id, user_name)) = curr_user.take() {
            all_users_data.push(YatraDataRowResponse::new(
                user_id,
                user_name,
                curr_user_data,
            ));
        }

        Self {
            practices,
            data: all_users_data,
            statistics,
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

#[derive(Serialize, Debug)]
pub struct GetYatraPracticeResponse {
    pub practice: YatraPractice,
}

#[derive(Serialize, Debug)]
pub struct YatraUsersResponse {
    pub users: Vec<YatraUser>,
}

#[derive(Serialize, Debug, Deserialize)]
pub struct YatraUserPractices {
    pub practices: Vec<YatraUserPractice>,
}
