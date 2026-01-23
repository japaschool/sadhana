use std::collections::HashMap;

use crate::{db_types::PracticeDataType, utils::date::*};
use chrono::{Days, NaiveDate};
use common::error::AppError;
use diesel::pg::PgConnection;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{Uuid as DieselUuid, *};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

#[derive(Deserialize, Debug)]
pub enum Aggregation {
    Sum,
    Avg,
    Min,
    Max,
    Count,
}

#[derive(Deserialize, Debug)]
pub enum TimeRange {
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
pub struct YatraStatistic {
    pub label: String,
    pub practice_id: Uuid,
    pub aggregation: Aggregation,
    pub time_range: TimeRange,
}

#[derive(Deserialize, Debug)]
pub struct YatraStatistics {
    pub visible_to_all: bool,
    pub statistics: Vec<YatraStatistic>,
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
        let is_admin = crate::app::yatras::domain::Yatra::is_admin(conn, user_id, yatra_id)?;
        let stats_conf = crate::app::yatras::domain::Yatra::get_yatra_stats(conn, yatra_id)?;

        if stats_conf
            .as_ref()
            .is_none_or(|conf| !(conf.visible_to_all || is_admin))
        {
            return Ok(vec![]);
        }

        let practice_types: HashMap<_, _> =
            crate::app::yatras::domain::YatraPractice::get_ordered_yatra_practices(conn, yatra_id)?
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
