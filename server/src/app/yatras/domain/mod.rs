use std::cmp::max;

use chrono::NaiveDate;
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

mod stats;

pub use stats::*;

use crate::{
    db_types::PracticeDataType,
    schema::{
        sql_types::PracticeDataTypeEnum, user_practices, users, yatra_practices,
        yatra_user_practices, yatra_users, yatras,
    },
};

use diesel::pg::PgConnection;

#[derive(Serialize, Deserialize, Debug, Queryable, Selectable)]
#[diesel(table_name = yatras)]
pub struct Yatra {
    pub id: Uuid,
    pub name: String,
    pub statistics: Option<JsonValue>,
    pub show_stability_metrics: bool,
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

    pub fn ensure_has_other_admins(
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

    pub fn leave(conn: &mut PgConnection, user_id: &Uuid, yatra_id: &Uuid) -> Result<(), AppError> {
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

    pub fn toggle_is_admin(
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

    pub fn get_yatra(conn: &mut PgConnection, yatra_id: &Uuid) -> Result<Self, AppError> {
        let res = yatras::table
            .select(Yatra::as_select())
            .filter(yatras::id.eq(&yatra_id))
            .first(conn)?;
        Ok(res)
    }

    pub fn get_yatra_stats(
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

    pub fn ensure_admin_user(
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

        Ok(Yatra {
            id,
            name,
            statistics: None,
            show_stability_metrics: false,
        })
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

    pub fn update(&self, conn: &mut PgConnection, user_id: &Uuid) -> Result<(), AppError> {
        Yatra::ensure_admin_user(conn, user_id, &self.id)?;

        diesel::update(yatras::table.find(&self.id))
            .set((
                yatras::name.eq(&self.name),
                yatras::statistics.eq(&self.statistics),
                yatras::show_stability_metrics.eq(&self.show_stability_metrics),
            ))
            .execute(conn)?;

        Ok(())
    }

    pub fn get_user_yatras(conn: &mut PgConnection, user_id: &Uuid) -> Result<Vec<Self>, AppError> {
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
    pub daily_score: Option<JsonValue>,
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
                yatra_practices::daily_score.eq(&practice.daily_score),
            ))
            .execute(conn)?;

        Ok(())
    }

    pub fn delete_int(
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
        data: &Vec<super::dto::UpdateYatraPracticeOrderKey>,
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
                        daily_score: None,
                    },
                    user_practice,
                },
            )
            .collect())
    }
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct YatraDataRaw {
    #[diesel(sql_type = DieselUuid)]
    pub user_id: Uuid,
    #[diesel(sql_type = Text)]
    pub user_name: String,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub value: Option<JsonValue>,
}

impl YatraDataRaw {
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
                    join yatra_user_practices yup
                        on yup.user_practice_id = d.practice_id
                where
                    d.cob_date = $2
            ),
            t as (
                select
                    u.id as user_id,
                    u."name" as user_name,
                    d.value,
                    yp.colour_zones,
                    yp.practice,
                    normalize_value(yp.data_type, d.value) as normalised_value,
                    normalize_value(yp.data_type, yp.daily_score->'mandatory_threshold') as mandatory_threshold,
                    yp.daily_score,
                    yp.data_type,
                    yp.order_key
                from
                    yatra_users yu
                    join users u
                        on u.id = yu.user_id
                    join yatra_practices yp
                        on yp.yatra_id = yu.yatra_id
                    left join d on (
                        d.yatra_practice_id = yp.id
                        and d.user_id = u.id
                    )
                where
                    yu.yatra_id = $1
            )
            select
                t.user_id,
                t.user_name,
                t.value,
                coalesce(
                    case daily_score->>'better_direction'
                        when 'Higher' then
                            case when normalised_value >= mandatory_threshold then 1 else 0 end
                        when 'Lower' then
                            case when normalised_value <= mandatory_threshold then 1 else 0 end
                    end,
                    0) as mandatory_score,
                coalesce((
                    select sum( (br->>'points')::int )
                    from jsonb_array_elements(daily_score->'bonus_rules') br
                    where
                        case daily_score->>'better_direction'
                        when 'Higher' then
                            normalised_value >= normalize_value(t.data_type, br->'threshold')
                        when 'Lower' then
                            normalised_value <= normalize_value(t.data_type, br->'threshold')
                        end
                    ),
                    0) as bonus_score
            from t
            order by 2,1, order_key
            "#,
        )
        .bind::<DieselUuid, _>(yatra_id)
        .bind::<Date, _>(cob_date)
        .load::<Self>(conn)?;

        Ok(data)
    }
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct DailyScore {
    #[diesel(sql_type = DieselUuid)]
    pub user_id: Uuid,
    #[diesel(sql_type = Integer)]
    pub day: i32,
    #[diesel(sql_type = SmallInt)]
    pub mandatory_score: i16,
    #[diesel(sql_type = SmallInt)]
    pub mandatory_total: i16,
    #[diesel(sql_type = SmallInt)]
    pub bonus_score: i16,
}

impl DailyScore {
    pub fn daily_total(&self) -> i16 {
        let score = if self.mandatory_total > 0 && self.mandatory_score < self.mandatory_total {
            self.mandatory_score
        } else {
            self.mandatory_score + self.bonus_score
        };
        score * 100 / max(self.mandatory_total, 1)
    }

    pub fn get_raw_scores(
        conn: &mut PgConnection,
        yatra_id: &Uuid,
        cob_date: &NaiveDate,
    ) -> Result<Vec<Self>, AppError> {
        let data = sql_query(
            r#"
        with days as (
        select generate_series(
            $2::date - interval '20 days',
            $2::date,
            interval '1 day'
        )::date as day
        ), user_data as (
        select dv.cob_date, dv.user_id, p.yatra_practice_id, dv.value
        from diary dv
        join yatra_user_practices p
            on p.user_practice_id = dv.practice_id
        ), per_practice as (
        select
            yu.user_id,
            d.day,
            /* mandatory per practice */
            case yp.daily_score->>'better_direction'
            when 'Higher' then
                case
                when normalize_value(yp.data_type, dv.value)
                    >= normalize_value(yp.data_type, yp.daily_score->'mandatory_threshold')
                then 1 else 0
                end
            when 'Lower' then
                case
                when normalize_value(yp.data_type, dv.value)
                    <= normalize_value(yp.data_type, yp.daily_score->'mandatory_threshold')
                then 1 else 0
                end
            end as mandatory_score,
            /* bonus per practice (gated by mandatory) */
            case
            when (
                case yp.daily_score->>'better_direction'
                when 'Higher' then
                    normalize_value(yp.data_type, dv.value)
                    >= normalize_value(yp.data_type, yp.daily_score->'mandatory_threshold')
                when 'Lower' then
                    normalize_value(yp.data_type, dv.value)
                    <= normalize_value(yp.data_type, yp.daily_score->'mandatory_threshold')
                end
            )
            then coalesce((
                select sum((br->>'points')::int)
                from jsonb_array_elements(
                yp.daily_score->'bonus_rules'
                ) br
                where
                case yp.daily_score->>'better_direction'
                    when 'Higher' then
                    normalize_value(yp.data_type, dv.value)
                    >= normalize_value(yp.data_type, br->'threshold')
                    when 'Lower' then
                    normalize_value(yp.data_type, dv.value)
                    <= normalize_value(yp.data_type, br->'threshold')
                end
            ), 0)
            else 0
            end as bonus_score,
            case
                when nullif(yp.daily_score->'mandatory_threshold', '{}') is not null then 1
                else 0
            end as has_mandatory
        from days d
        join yatra_users yu
            on yu.yatra_id = $1
        join yatra_practices yp
            on yp.yatra_id = yu.yatra_id
        left join user_data dv
            on dv.cob_date = d.day
            and dv.user_id = yu.user_id
            and dv.yatra_practice_id = yp.id
        ),
        per_day as (
        select
            user_id,
            day,
            coalesce(sum(mandatory_score), 0)::smallint as mandatory_score,
            sum(has_mandatory)::smallint   as mandatory_total,
            sum(bonus_score)::smallint     as bonus_score
        from per_practice
        group by user_id, day
        )
        select
            user_id,
            extract(day from day)::integer as day,
            mandatory_score,
            mandatory_total,
            bonus_score
        from per_day
        order by user_id, per_day.day
        "#,
        )
        .bind::<DieselUuid, _>(yatra_id)
        .bind::<Date, _>(cob_date)
        .load::<Self>(conn)?;

        Ok(data)
    }
}
