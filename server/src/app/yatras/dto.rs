use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use super::{
    model::{YatraDataRow, YatraPractice},
    stats::YatraStatisticResult,
};

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
    pub yatra: crate::app::yatras::model::Yatra,
}

#[derive(Deserialize, Debug)]
pub struct CreateYatraPracticeForm {
    pub practice: crate::app::yatras::model::NewYatraPractice,
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
    pub yatras: Vec<crate::app::yatras::model::Yatra>,
}

#[derive(Serialize, Debug)]
pub struct YatraResponse {
    pub yatra: crate::app::yatras::model::Yatra,
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
    pub users: Vec<crate::app::yatras::model::YatraUser>,
}

#[derive(Serialize, Debug, Deserialize)]
pub struct YatraUserPractices {
    pub practices: Vec<crate::app::yatras::model::YatraUserPractice>,
}
