use actix_web::{web, HttpResponse};
use chrono::NaiveDate;
use common::error::AppError;
use diesel::{
    prelude::*,
    sql_query,
    sql_types::{BigInt, Date},
};
use serde::Serialize;

use crate::middleware::state::AppState;

/// Public usage stats for the /stats page: aggregate counts only, never per-user data.
pub async fn get_stats(state: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    let mut conn = state.get_conn()?;
    let weeks = web::block(move || weekly(&mut conn)).await??;
    Ok(HttpResponse::Ok().json(StatsResponse { weeks }))
}

#[derive(Serialize)]
struct StatsResponse {
    weeks: Vec<Week>,
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct Week {
    #[diesel(sql_type = Date)]
    pub week: NaiveDate,
    #[diesel(sql_type = BigInt)]
    pub signups: i64,
    /// Users who logged at least one diary entry that week.
    #[diesel(sql_type = BigInt)]
    pub active: i64,
}

/// One row per week (Monday) from the first sign-up to now, empty weeks included.
pub fn weekly(conn: &mut PgConnection) -> Result<Vec<Week>, AppError> {
    Ok(sql_query(
        r#"
        with s as (select date_trunc('week', created_at) w, count(*) n from users group by 1),
             a as (select date_trunc('week', created_at) w, count(distinct user_id) n from diary group by 1)
        select g.w::date as week, coalesce(s.n, 0) as signups, coalesce(a.n, 0) as active
        from generate_series(date_trunc('week', (select min(created_at) from users)),
                             date_trunc('week', now()), '1 week') g(w)
        left join s on s.w = g.w
        left join a on a.w = g.w
        order by 1
        "#,
    )
    .load(conn)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::db;
    use diesel::sql_types::{Text, Uuid as DieselUuid};
    use uuid::Uuid;

    fn new_user(conn: &mut PgConnection, created_at: &str) -> QueryResult<Uuid> {
        let id = Uuid::new_v4();
        sql_query("insert into users (id, email, hash, name, created_at) values ($1, $1::text || '@stats.test', '', 'x', $2::timestamptz)")
            .bind::<DieselUuid, _>(id)
            .bind::<Text, _>(created_at)
            .execute(conn)?;
        Ok(id)
    }

    #[test]
    fn counts_signups_and_distinct_active_users_per_week() {
        let mut conn = db::establish_connection().get().unwrap();
        conn.test_transaction::<_, AppError, _>(|conn| {
            // Two sign-ups in the week of Mon 2001-01-01; one of them logs twice that week and once the next.
            let user_id = new_user(conn, "2001-01-03")?;
            new_user(conn, "2001-01-05")?;
            let practice_id = Uuid::new_v4();
            sql_query("insert into user_practices (id, user_id, practice, data_type, is_active, order_key) values ($1, $2, 'p', 'int', true, 0)")
                .bind::<DieselUuid, _>(practice_id)
                .bind::<DieselUuid, _>(user_id)
                .execute(conn)?;
            for day in ["2001-01-03", "2001-01-04", "2001-01-09"] {
                sql_query("insert into diary (cob_date, user_id, practice_id, created_at) values ($1::date, $2, $3, $1::timestamptz)")
                    .bind::<Text, _>(day)
                    .bind::<DieselUuid, _>(user_id)
                    .bind::<DieselUuid, _>(practice_id)
                    .execute(conn)?;
            }

            let weeks = weekly(conn)?;
            let at = |d: &str| {
                let d = NaiveDate::parse_from_str(d, "%Y-%m-%d").unwrap();
                weeks.iter().find(|w| w.week == d).map(|w| (w.signups, w.active))
            };
            assert_eq!(at("2001-01-01"), Some((2, 1)));
            assert_eq!(at("2001-01-08"), Some((0, 1)));
            assert_eq!(at("2001-01-15"), Some((0, 0)));
            Ok(())
        });
    }
}
