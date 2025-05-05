use std::fmt::Display;

use anyhow::{anyhow, Context};
use chrono::{naive::NaiveDate, NaiveDateTime};
use js_sys::RegExp;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

use crate::i18n::Locale;

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
    pub current_password: String,
    pub new_password: String,
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
    pub lang: String,
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
    pub server_address: String,
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

#[derive(Deserialize, Clone, Debug)]
pub struct IncompleteDays {
    pub days: Vec<NaiveDate>,
}

/// Assumes values are sorted by DiaryEntry.practice
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DiaryDay {
    pub diary_day: Vec<DiaryEntry>,
}

/// Assumes values are sorted by DiaryEntry.practice
#[derive(Debug, Serialize, Clone)]
pub struct SaveDiaryDay<'a> {
    pub diary_day: &'a Vec<DiaryEntry>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SaveDiaryDayEntry<'a> {
    pub entry: &'a DiaryEntry,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct DiaryEntry {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub value: Option<PracticeEntryValue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Copy, Deserialize)]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    Text,
    Duration,
}

impl Default for PracticeDataType {
    fn default() -> Self {
        Self::Text
    }
}

impl Display for PracticeDataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            PracticeDataType::Int => "int",
            PracticeDataType::Bool => "bool",
            PracticeDataType::Time => "time",
            PracticeDataType::Text => "text",
            PracticeDataType::Duration => "duration",
        };
        write!(f, "{}", s)
    }
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PracticeEntryValue {
    Int(u16),
    Bool(bool),
    Time { h: u8, m: u8 },
    Text(String),
    Duration(u16),
}

lazy_static! {
    static ref DURATION_R_P: String = r"(?:(\d+)[^\d]+)?(\d+)[^\d]+".to_string();
}

impl TryFrom<(&PracticeDataType, &str)> for PracticeEntryValue {
    type Error = anyhow::Error;

    fn try_from(value: (&PracticeDataType, &str)) -> Result<Self, Self::Error> {
        let res = match value.0 {
            PracticeDataType::Int => value
                .1
                .parse()
                .map(PracticeEntryValue::Int)
                .with_context(|| format!("Failed to parse int from {}", value.1))?,
            PracticeDataType::Bool => value
                .1
                .parse()
                .map(PracticeEntryValue::Bool)
                .with_context(|| format!("Failed to parse bool from {}", value.1))?,
            PracticeDataType::Time => value
                .1
                .split_once(':')
                .and_then(|(h, m)| {
                    let h = h.parse().ok()?;
                    let m = m.parse().ok()?;
                    Some(PracticeEntryValue::Time { h, m })
                })
                .ok_or_else(|| anyhow!("Couldn't parse time from {}", value.1))?,
            PracticeDataType::Text => PracticeEntryValue::Text(value.1.to_owned()),
            PracticeDataType::Duration => RegExp::new(&DURATION_R_P, "")
                .exec(value.1)
                .iter()
                .filter_map(|cap| {
                    cap.get(2).as_string().and_then(|m_str| {
                        m_str.parse::<u16>().ok().map(|m| {
                            PracticeEntryValue::Duration(
                                m + 60
                                    * cap
                                        .get(1)
                                        .as_string()
                                        .and_then(|h_str| h_str.as_str().parse::<u16>().ok())
                                        .unwrap_or_default(),
                            )
                        })
                    })
                })
                .next()
                .ok_or_else(|| anyhow!("Couldn't parse duration from {}", value.1))?,
        };
        Ok(res)
    }
}

impl Display for PracticeEntryValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            PracticeEntryValue::Int(i) => i.to_string(),
            PracticeEntryValue::Bool(b) => b.to_string(),
            PracticeEntryValue::Time { h: _, m: _ } => self.as_time_str().unwrap(),
            PracticeEntryValue::Text(_) => self.as_text().unwrap(),
            PracticeEntryValue::Duration(_) => self.as_duration_str().unwrap(),
        };
        write!(f, "{}", s)
    }
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

    pub fn as_duration_mins(&self) -> Option<u16> {
        match self {
            &PracticeEntryValue::Duration(mins) => Some(mins),
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

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct UserPractice {
    pub id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
    pub is_active: bool,
    pub is_required: Option<bool>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Default)]
pub struct NewUserPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub is_active: bool,
    pub is_required: Option<bool>,
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
    pub value: Option<PracticeEntryValue>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct Yatra {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Yatras {
    pub yatras: Vec<Yatra>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct YatraPractice {
    pub practice: String,
    pub data_type: PracticeDataType,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraPractices {
    pub practices: Vec<YatraPractice>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct YatraUser {
    pub user_id: String,
    pub user_name: String,
    pub is_admin: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraUsers {
    pub users: Vec<YatraUser>,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatraPracticesOrderKey {
    pub practices: Vec<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct YatraData {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<(String, Vec<Option<PracticeEntryValue>>)>,
}

#[derive(Debug, Serialize)]
pub struct CreateYatra {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct RenameYatra {
    pub name: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraResponse {
    pub yatra: Yatra,
}
#[derive(Debug, Deserialize, Clone)]
pub struct IsYatraAdminResponse {
    pub is_admin: bool,
}

#[derive(Debug, Serialize)]
pub struct CreateYatraPractice {
    pub practice: YatraPractice,
}

#[derive(Debug, Serialize)]
pub struct YatraPracticeUpdate {
    pub practice: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatraPractice {
    pub update: YatraPracticeUpdate,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct YatraUserPractice {
    pub yatra_practice: YatraPractice,
    pub user_practice: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct YatraUserPractices {
    pub practices: Vec<YatraUserPractice>,
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
