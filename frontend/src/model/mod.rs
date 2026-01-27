use chrono::naive::NaiveDate;
use serde::{Deserialize, Serialize};

mod auth;
mod value;
mod yatra;

pub use auth::*;
pub use value::*;
pub use yatra::*;

#[derive(Deserialize, Clone, Debug)]
pub struct IncompleteDays {
    pub days: Vec<NaiveDate>,
}

/// Assumes values are sorted by DiaryEntry.practice
#[derive(Debug, Deserialize, PartialEq, Serialize, Clone)]
pub struct DiaryDay {
    pub diary_day: Vec<DiaryEntry>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SaveDiaryDayEntry<'a> {
    pub entry: &'a DiaryEntry,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct DiaryEntry {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub dropdown_variants: Option<String>,
    pub value: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct UserPractice {
    pub id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
    pub is_active: bool,
    pub is_required: Option<bool>,
    pub dropdown_variants: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Default)]
pub struct NewUserPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub is_active: bool,
    pub is_required: Option<bool>,
    pub dropdown_variants: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GetUserPractice {
    pub practice: UserPractice,
}

#[derive(Debug, Deserialize)]
pub struct AllUserPractices {
    pub user_practices: Vec<UserPractice>,
}

#[derive(Debug, Serialize)]
pub struct CreateUserPractice {
    pub user_practice: NewUserPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateUserPractice<'a> {
    pub user_practice: &'a UserPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateUserPracticesOrderKey<'a> {
    pub practices: &'a Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportData {
    pub values: Vec<ReportDataEntry>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct ReportDataEntry {
    pub cob_date: NaiveDate,
    pub practice: String,
    pub value: Option<Value>,
}
#[derive(Debug, Serialize, Clone)]
pub struct SupportMessageForm {
    pub subject: String,
    pub message: String,
}

impl SupportMessageForm {
    pub fn new<S: Into<String>>(subject: S, message: S) -> Self {
        Self {
            subject: subject.into(),
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct ApiVersion {
    pub git_sha: String,
}
