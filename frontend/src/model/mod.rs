use std::fmt::Display;

use anyhow::{Context, anyhow};
use chrono::{NaiveDateTime, naive::NaiveDate};
use js_sys::RegExp;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use strum::{Display, EnumIter, EnumString};

use crate::{i18n::Locale, tr};

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

#[derive(Debug, Serialize, Clone)]
pub struct SaveDiaryDayEntry<'a> {
    pub entry: &'a DiaryEntry,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
pub struct DiaryEntry {
    pub practice: String,
    pub data_type: PracticeDataType,
    pub dropdown_variants: Option<String>,
    pub value: Option<PracticeEntryValue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Copy, Deserialize, Default)]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    #[default]
    Text,
    Duration,
}

impl PracticeDataType {
    pub fn to_localised_string(&self) -> String {
        match self {
            PracticeDataType::Int => tr!(integer),
            PracticeDataType::Bool => tr!(boolean),
            PracticeDataType::Time => tr!(time),
            PracticeDataType::Text => tr!(text),
            PracticeDataType::Duration => tr!(duration),
        }
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

fn adjust_bool_str(s: &str) -> String {
    if s == "✓" {
        "true".to_string()
    } else {
        s.to_lowercase()
    }
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
            PracticeDataType::Bool => adjust_bool_str(value.1)
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
            PracticeEntryValue::Bool(b) => (if *b { "✓" } else { "" }).to_string(),
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
                    if minutes > 0 {
                        format!(
                            "{hours}{hours_label} {minutes}{minutes_label}",
                            hours = hours,
                            minutes = minutes,
                            hours_label = Locale::current().hours_label(),
                            minutes_label = Locale::current().minutes_label()
                        )
                    } else {
                        format!(
                            "{hours}{hours_label}",
                            hours = hours,
                            hours_label = Locale::current().hours_label()
                        )
                    }
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

    pub fn as_comparable(&self) -> Option<i64> {
        match self {
            PracticeEntryValue::Int(i) => Some(i32::from(*i) as i64),
            PracticeEntryValue::Duration(mins) => Some(i64::from(*mins) * 60),
            PracticeEntryValue::Time { h, m } => Some(i64::from(*h) * 3600 + i64::from(*m) * 60),
            _ => None,
        }
    }
}

impl PartialOrd for PracticeEntryValue {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        match (self.as_comparable(), other.as_comparable()) {
            (Some(a), Some(b)) => Some(a.cmp(&b)),
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
    pub value: Option<PracticeEntryValue>,
}

#[derive(
    Debug, Serialize, Deserialize, Clone, PartialEq, Default, Display, EnumIter, EnumString,
)]
pub enum Aggregation {
    Sum,
    Avg,
    Min,
    Max,
    #[default]
    Count,
}

impl Aggregation {
    pub fn to_localised_string(&self) -> String {
        match self {
            Aggregation::Sum => tr!(yatra_stats_agg_sum),
            Aggregation::Avg => tr!(yatra_stats_agg_avg),
            Aggregation::Min => tr!(yatra_stats_agg_min),
            Aggregation::Max => tr!(yatra_stats_agg_max),
            Aggregation::Count => tr!(yatra_stats_agg_cnt),
        }
    }
}

#[derive(
    Debug, Serialize, Deserialize, Clone, PartialEq, Default, Display, EnumIter, EnumString,
)]
pub enum TimeRange {
    Last7Days,
    Last30Days,
    Last90Days,
    Last365Days,
    ThisWeek,
    #[default]
    ThisMonth,
    ThisQuarter,
    ThisYear,
}

impl TimeRange {
    pub fn to_localised_string(&self) -> String {
        match self {
            TimeRange::Last7Days => tr!(yatra_stats_time_range_last_7_days),
            TimeRange::Last30Days => tr!(yatra_stats_time_range_last_30_days),
            TimeRange::Last90Days => tr!(yatra_stats_time_range_last_90_days),
            TimeRange::Last365Days => tr!(yatra_stats_time_range_last_365_days),
            TimeRange::ThisWeek => tr!(yatra_stats_time_range_this_week),
            TimeRange::ThisMonth => tr!(yatra_stats_time_range_this_month),
            TimeRange::ThisQuarter => tr!(yatra_stats_time_range_this_quarter),
            TimeRange::ThisYear => tr!(yatra_stats_time_range_this_year),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct YatraStatistic {
    pub label: String,
    pub practice_id: String,
    pub aggregation: Aggregation,
    pub time_range: TimeRange,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct YatraStatistics {
    pub visible_to_all: bool,
    pub statistics: Vec<YatraStatistic>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct Yatra {
    pub id: String,
    pub name: String,
    pub statistics: Option<YatraStatistics>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Yatras {
    pub yatras: Vec<Yatra>,
}

#[derive(
    Clone, PartialEq, Display, Debug, Default, EnumString, EnumIter, Deserialize, Serialize,
)]
pub enum ZoneColour {
    #[default]
    Neutral,
    Red,
    Yellow,
    Green,
}

impl ZoneColour {
    pub fn to_localised_string(&self) -> String {
        match self {
            ZoneColour::Neutral => tr!(colour_neutral),
            ZoneColour::Red => tr!(colour_red),
            ZoneColour::Yellow => tr!(colour_yellow),
            ZoneColour::Green => tr!(colour_green),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Default)]
pub struct ColourZonesConfig {
    pub better_direction: BetterDirection,
    pub bounds: Vec<Bound>,
    pub no_value_colour: ZoneColour,
}

impl ColourZonesConfig {
    pub fn find_zone(&self, value: Option<&PracticeEntryValue>) -> ZoneColour {
        if value.is_none() {
            return self.no_value_colour.clone();
        }

        for bound in &self.bounds {
            let Some(to) = &bound.to else {
                continue; // ignore None
            };
            if value.unwrap() <= to {
                return bound.colour.clone();
            }
        }
        // fallback
        match self.better_direction {
            BetterDirection::Higher => ZoneColour::Green,
            BetterDirection::Lower => ZoneColour::Red,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Display, EnumString, Deserialize, Serialize, Default)]
pub enum BetterDirection {
    #[default]
    Higher,
    Lower,
}

impl BetterDirection {
    pub fn to_localised_string(&self) -> String {
        match self {
            BetterDirection::Higher => tr!(colour_zones_better_when_higher),
            BetterDirection::Lower => tr!(colour_zones_better_when_lower),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize)]
pub struct Bound {
    pub to: Option<PracticeEntryValue>,
    pub colour: ZoneColour,
}

impl Bound {
    pub fn default_red() -> Self {
        Self {
            colour: ZoneColour::Red,
            ..Default::default()
        }
    }
    pub fn default_yellow() -> Self {
        Self {
            colour: ZoneColour::Yellow,
            ..Default::default()
        }
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct NewYatraPractice {
    pub yatra_id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Default)]
pub struct YatraPractice {
    pub id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
    pub colour_zones: Option<ColourZonesConfig>,
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

#[derive(Debug, Deserialize, Clone)]
pub struct YatraDataRow {
    pub user_id: String,
    pub user_name: String,
    pub row: Vec<Option<PracticeEntryValue>>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraStatisticRow {
    pub label: String,
    pub value: Option<PracticeEntryValue>,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct YatraData {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<YatraDataRow>,
    pub statistics: Vec<YatraStatisticRow>,
}

#[derive(Debug, Serialize)]
pub struct CreateYatra {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatra {
    pub yatra: Yatra,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraResponse {
    pub yatra: Yatra,
}
#[derive(Debug, Deserialize, Clone)]
pub struct IsYatraAdminResponse {
    pub is_admin: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GetYatraPractice {
    pub practice: YatraPractice,
}

#[derive(Debug, Serialize)]
pub struct CreateYatraPractice {
    pub practice: NewYatraPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatraPractice<'a> {
    pub practice: &'a YatraPractice,
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

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct BuildInfo {
    pub git_hash: String,
    pub build_time: String,
}
