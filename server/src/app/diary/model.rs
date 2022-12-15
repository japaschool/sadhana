use crate::{db_types::PracticeDataType, schema::sql_types::PracticeDataTypeEnum};
use chrono::NaiveDate;
use common::error::AppError;
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
        left join (
            select *
            from diary d
            where d.cob_date = $1
            ) d
        on up.user_id = d.user_id 
        and up.id = d.practice_id
        and coalesce(up.valid_from, '2001-01-01') <= $1
        and coalesce(up.valid_to, '9999-12-31') >= $1
        and up.user_id = $2
        order by up.practice
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
            let sql = r#"
            insert into diary(cob_date, user_id, practice_id, value)
            values($1, $2, (select id from user_practices where user_id = $2 and practice = $3), $4)
            on conflict (cob_date, user_id, practice_id)
            do update set value = EXCLUDED.value; 
            "#;

            let mut res = Ok(0);

            for entry in diary_day {
                res = sql_query(sql)
                    .bind::<Date, _>(entry.cob_date)
                    .bind::<DieselUuid, _>(entry.user_id)
                    .bind::<Text, _>(entry.practice)
                    .bind::<Nullable<Jsonb>, _>(entry.value)
                    .execute(conn);
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
