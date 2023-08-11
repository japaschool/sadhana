use crate::{db_types::PracticeDataType, schema::sql_types::PracticeDataTypeEnum};
use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use diesel::{prelude::*, sql_query, sql_types::Uuid as DieselUuid, sql_types::*};
use serde::Serialize;
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Serialize, Debug, QueryableByName)]
pub struct DiaryDayEntry {
    #[diesel(sql_type = Text)]
    pub practice: String,
    #[diesel(sql_type = PracticeDataTypeEnum)]
    pub data_type: PracticeDataType,
    #[diesel(sql_type = Nullable<Jsonb>)]
    pub value: Option<JsonValue>,
}

impl DiaryDayEntry {
    pub fn get_diary_day(
        conn: &mut PgConnection,
        cob_date: &NaiveDate,
        user_id: &Uuid,
    ) -> Result<Vec<Self>, AppError> {
        let res = sql_query(
            r#"
        select up.practice, up.data_type, d.value
        from user_practices up
        left join diary d
        on up.user_id = d.user_id 
        and up.id = d.practice_id
        and d.cob_date = $1
        where up.is_active = true
        and up.user_id = $2
        order by up.order_key
        "#,
        )
        .bind::<Date, _>(cob_date)
        .bind::<DieselUuid, _>(user_id)
        .load::<Self>(conn)?;

        Ok(res)
    }

    pub fn upsert(
        conn: &mut PgConnection,
        diary_day: &Vec<DiaryEntryUpdate>,
    ) -> Result<(), AppError> {
        conn.transaction(|conn| {
            // Deleting entries that were set to None
            let delete_sql = r#"
            delete from diary d 
            where d.cob_date = $1 
            and d.user_id = $2
            and d.practice_id = (select id from user_practices where user_id = $2 and practice = $3)
            "#;

            // Upserting entries with non-empty values
            let upsert_sql = r#"
            insert into diary(cob_date, user_id, practice_id, value)
            values($1, $2, (select id from user_practices where user_id = $2 and practice = $3), $4)
            on conflict (cob_date, user_id, practice_id)
            do update set value = EXCLUDED.value; 
            "#;

            let mut res = Ok(0);

            for entry in diary_day {
                if entry.value.is_some() {
                    res = sql_query(upsert_sql)
                        .bind::<Date, _>(entry.cob_date)
                        .bind::<DieselUuid, _>(entry.user_id)
                        .bind::<Text, _>(entry.practice)
                        .bind::<Nullable<Jsonb>, _>(entry.value)
                        .execute(conn);
                } else {
                    res = sql_query(delete_sql)
                        .bind::<Date, _>(entry.cob_date)
                        .bind::<DieselUuid, _>(entry.user_id)
                        .bind::<Text, _>(entry.practice)
                        .execute(conn);
                }
                if res.is_err() {
                    break;
                }
            }

            res
        })?;

        Ok(())
    }
}

#[derive(Debug)]
pub struct DiaryEntryUpdate<'a> {
    pub cob_date: &'a NaiveDate,
    pub user_id: &'a Uuid,
    pub practice: &'a str,
    pub value: Option<&'a JsonValue>,
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct ReportEntry {
    #[diesel(sql_type = Date)]
    cob_date: NaiveDate,
    #[diesel(sql_type = Text)]
    practice: String,
    #[diesel(sql_type = Nullable<Jsonb>)]
    value: Option<JsonValue>,
}

impl ReportEntry {
    pub fn get_report_data(
        conn: &mut PgConnection,
        user_id: &Uuid,
        practice: &Option<String>,
        duration: &ReportDuration,
    ) -> Result<Vec<Self>, AppError> {
        use diesel::pg::expression::extensions::IntervalDsl;

        let interval = match duration {
            ReportDuration::Last7Days => 6.days(),
            ReportDuration::Last30Days => 29.days(),
            ReportDuration::Last90Days => 89.days(),
            ReportDuration::Last365Days => 364.days(),
        };

        let res = sql_query(
            r#"
            with dates as (
                select
                    t.cob_date :: date
                from
                    generate_series(
                        now() - $3,
                        now(),
                        interval '1 day'
                    ) as t(cob_date)
            )
            select
                dt.cob_date,
                up.practice,
                d.value
            from
                dates dt
                cross join user_practices up
                left join diary d on d.cob_date = dt.cob_date
                and d.practice_id = up.id
            where
                up.user_id = $1
                and up.is_active = true
                and (up.practice = $2 or $2 is null)
            order by
                dt.cob_date,
                up.order_key;
        "#,
        )
        .bind::<DieselUuid, _>(user_id)
        .bind::<Nullable<Text>, _>(practice)
        .bind::<Interval, _>(interval)
        .load::<Self>(conn)?;

        Ok(res)
    }
}

#[derive(Serialize, Debug, QueryableByName)]
pub struct IncompleteCob {
    #[diesel(sql_type = Date)]
    pub cob_date: NaiveDate,
}

impl IncompleteCob {
    pub fn get_incomplete_days(
        conn: &mut PgConnection,
        user_id: &Uuid,
        date: &NaiveDate,
    ) -> Result<Vec<Self>, AppError> {
        let week = date.week(chrono::Weekday::Mon);
        let start = week.first_day();
        let end = week.last_day();

        let res = sql_query(
            r#"
            with dates as (
                select
                    t.cob_date :: date
                from
                    generate_series(
                        $1,
                        $2,
                        interval '1 day'
                    ) as t(cob_date)
            )
            select
                dates.cob_date
            from
                dates
                cross join user_practices up
                left join diary d on up.id = d.practice_id
                and d.cob_date = dates.cob_date
            where
                up.is_required = true
                and d.value is null
                and up.user_id = $3
                and dates.cob_date < now()
            "#,
        )
        .bind::<Date, _>(&start)
        .bind::<Date, _>(&end)
        .bind::<DieselUuid, _>(&user_id)
        .load(conn)?;

        Ok(res)
    }
}

//TODO: test `upsert` that empty values are not inserted (and deleted if a value becomes empty) from diary
