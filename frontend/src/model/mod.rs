use chrono::{naive::NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};

use crate::i18n::Locale;

//FIXME: break up into sub modules
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub token: String,
    pub name: String,
}

impl UserInfo {
    pub fn is_authenticated(&self) -> bool {
        !self.token.is_empty()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct UserInfoWrapper {
    pub user: UserInfo,
}

#[derive(Serialize, Debug, Default, Clone)]
pub struct UpdateUser {
    pub name: String,
}

impl UpdateUser {
    pub fn new(name: impl Into<String>) -> Self {
        UpdateUser { name: name.into() }
    }
}

#[derive(Serialize, Debug)]
pub struct UpdateUserWrapper {
    pub user: UpdateUser,
}

#[derive(Serialize, Debug)]
pub struct UpdateUserPassword {
    pub password: String,
}

#[derive(Serialize, Debug)]
pub struct ResetPasswordWrapper {
    pub data: ResetPassword,
}

#[derive(Serialize, Debug)]
pub struct ResetPassword {
    pub confirmation_id: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoginInfoWrapper {
    pub user: LoginInfo,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct LoginInfo {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RegisterInfo {
    pub confirmation_id: String,
    pub email: String,
    pub password: String,
    pub name: String,
}

#[derive(Clone, PartialEq, Serialize, Debug)]
pub enum ConfirmationType {
    Registration,
    PasswordReset,
}

#[derive(Debug, Serialize)]
pub struct SendConfirmationLink {
    pub email: String,
    pub confirmation_type: ConfirmationType,
}

#[derive(Debug, Serialize)]
pub struct SendConfirmationLinkWrapper {
    pub data: SendConfirmationLink,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SignupLinkDetailsWrapper {
    pub confirmation: Confirmation,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct Confirmation {
    pub id: String,
    pub email: String,
    pub expires_at: NaiveDateTime,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RegisterInfoWrapper {
    pub user: RegisterInfo,
}

/// Assumes values are sorted by DiaryEntry.practice
#[derive(Debug, Deserialize, Serialize)]
pub struct DiaryDay {
    pub diary_day: Vec<DiaryEntry>,
    pub cob_date: NaiveDate,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct DiaryEntry {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub value: Option<PracticeEntryValue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Copy, Deserialize)]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    Text,
    Duration,
}

impl TryFrom<&str> for PracticeDataType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "int" => Ok(PracticeDataType::Int),
            "bool" => Ok(PracticeDataType::Bool),
            "time" => Ok(PracticeDataType::Time),
            "text" => Ok(PracticeDataType::Text),
            "duration" => Ok(PracticeDataType::Duration),
            _ => Err(format!("Unknown PracticeDataType value {}", value)),
        }
    }
}

#[derive(Debug, Clone)]
pub struct PracticeEntry {
    pub practice_name: String,
    pub value: PracticeEntryValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PracticeEntryValue {
    Int(u16),
    Bool(bool),
    Time { h: u8, m: u8 },
    Text(String),
    Duration(u16),
}

impl PracticeEntryValue {
    pub fn as_int(&self) -> Option<u16> {
        match self {
            &PracticeEntryValue::Int(i) => Some(i),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            &PracticeEntryValue::Bool(b) => Some(b),
            _ => None,
        }
    }

    pub fn as_time_str(&self) -> Option<String> {
        match self {
            &PracticeEntryValue::Time { h, m } => {
                Some(format!("{:0width$}:{:0width$}", h, m, width = 2))
            }
            _ => None,
        }
    }

    pub fn as_duration_str(&self) -> Option<String> {
        match self {
            &PracticeEntryValue::Duration(mins) => {
                let hours = mins / 60;
                let minutes = mins % 60;
                let res = if hours > 0 {
                    format!(
                        "{hours}{hours_label} {minutes}{minutes_label}",
                        hours = hours,
                        minutes = minutes,
                        hours_label = Locale::current().hours_label(),
                        minutes_label = Locale::current().minutes_label()
                    )
                } else {
                    format!(
                        "{minutes}{minutes_label}",
                        minutes = minutes,
                        minutes_label = Locale::current().minutes_label()
                    )
                };
                Some(res)
            }
            _ => None,
        }
    }

    pub fn as_text(&self) -> Option<String> {
        match &self {
            &PracticeEntryValue::Text(s) => Some(s.clone()),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct UserPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct AllUserPractices {
    pub user_practices: Vec<UserPractice>,
}

#[derive(Debug, Serialize)]
pub struct CreateUserPractice {
    pub user_practice: UserPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateUserPractice {
    pub user_practice: UserPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateUserPracticesOrderKey {
    pub practices: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReportData {
    pub values: Vec<ReportDataEntry>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct ReportDataEntry {
    pub cob_date: NaiveDate,
    pub value: Option<PracticeEntryValue>,
}
