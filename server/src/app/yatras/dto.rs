use std::collections::HashMap;

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use super::{domain::*, service::*};

pub type YatraIdSlug = Uuid;
pub type YatraIdPracticeSlug = (Uuid, Uuid);
pub type YatraIdUserIdSlug = (Uuid, Uuid);

#[derive(Deserialize, Debug)]
pub struct YatraDataQueryParams {
    pub cob_date: NaiveDate,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraForm {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateYatraForm {
    pub yatra: Yatra,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraPracticeForm {
    pub practice: NewYatraPractice,
}

#[derive(Deserialize, Debug)]
pub struct UpdateYatraPractice {
    pub practice: YatraPractice,
}

#[derive(Debug, Deserialize)]
pub struct UpdateYatraPracticeOrderKeyRequest {
    pub practices: Vec<Uuid>,
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
pub struct UserYatraData {
    pub user_id: Uuid,
    pub user_name: String,
    pub row: Vec<Option<JsonValue>>,
    pub trend_arrow: Option<TrendArrow>,
    pub stability_heatmap: Vec<i16>,
}

impl UserYatraData {
    fn new(
        user_id: Uuid,
        user_name: String,
        row: Vec<Option<JsonValue>>,
        trend_arrow: Option<TrendArrow>,
        heatmap_values: Vec<i16>,
    ) -> Self {
        Self {
            user_id,
            user_name,
            row,
            trend_arrow,
            stability_heatmap: heatmap_values,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct YatraDataResponse {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<UserYatraData>,
    pub statistics: Vec<YatraStatisticResult>,
    pub stability_heatmap_days: Vec<i32>,
}

impl
    From<(
        NaiveDate,
        Vec<YatraPractice>,
        Vec<YatraDataRaw>,
        Vec<YatraStatisticResult>,
        Vec<DailyScore>,
    )> for YatraDataResponse
{
    fn from(
        value: (
            NaiveDate,
            Vec<YatraPractice>,
            Vec<YatraDataRaw>,
            Vec<YatraStatisticResult>,
            Vec<DailyScore>,
        ),
    ) -> Self {
        let (cob, practices, rows, statistics, raw_scores) = value;

        let mut user_scores: HashMap<_, Vec<_>> = HashMap::new();

        // Assumes the data is already sorted by date
        for score in raw_scores.into_iter() {
            user_scores.entry(score.user_id).or_default().push(score);
        }

        let stability_heatmap_days = user_scores
            .iter()
            .take(1)
            .flat_map(|s| s.1[6..=20].iter().map(|s| s.day))
            .collect();

        let mut user_metrics: HashMap<Uuid, UserMetrics> = user_scores
            .into_iter()
            .map(|(user, scores)| (user, UserMetrics::from((cob, scores))))
            .collect();

        // Re-aggregating the values that come in flat
        // Note, assumes data comes in sorted by user and then practice order key
        let mut data = vec![];
        let mut rows = rows.into_iter().peekable();

        while let Some(row) = rows.next() {
            let user_id = row.user_id;
            let user_name = row.user_name;
            let mut user_values = vec![row.value];

            // collect all rows for this user in one pass
            while let Some(next) = rows.peek() {
                if next.user_id == user_id {
                    user_values.push(rows.next().unwrap().value);
                } else {
                    break;
                }
            }

            // extract metrics once
            let (trend_arrow, heatmap_values) = user_metrics
                .remove(&user_id)
                .map(
                    |UserMetrics {
                         trend_arrow,
                         stability_heatmap,
                     }| (trend_arrow, stability_heatmap),
                )
                .unwrap_or((None, vec![]));

            data.push(UserYatraData::new(
                user_id,
                user_name,
                user_values,
                trend_arrow,
                heatmap_values,
            ));
        }

        Self {
            practices,
            data,
            statistics,
            stability_heatmap_days,
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
