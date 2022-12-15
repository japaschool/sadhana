use chrono::naive::NaiveDate;
use serde::{Deserialize, Serialize};

//FIXME: break up into sub modules
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct UserInfo {
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
// #[serde(rename_all = "camelCase")]
pub struct RegisterInfo {
    pub email: String,
    pub password: String,
    pub name: String,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
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
}

// #[derive(Debug, Clone)]
// pub struct EnabledPractices {
//     pub practices: Vec<Practice>,
// }

// #[derive(Debug, Clone)]
// pub struct Practice {
//     pub name: String,
//     pub value_type: PracticeDataType,
// }
