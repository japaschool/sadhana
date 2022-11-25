use std::collections::HashMap;

use serde::{Deserialize, Serialize};

//FIXME: factor out to model into a separate crate to be used by both frontend and backend
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

/// Error info for Unprocessable Entity error
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
// #[serde(rename_all = "camelCase")]
pub struct ErrorInfo {
    pub errors: HashMap<String, Vec<String>>,
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

#[derive(Debug, Clone)]
pub struct JournalEntry {
    pub values: HashMap<String, PracticeEntryValue>,
}

#[derive(Debug, Clone)]
pub struct PracticeEntry {
    pub practice_name: String,
    pub value: PracticeEntryValue,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PracticeEntryValue {
    Int(u16),
    Bool(bool),
    Time { h: u8, m: u8 },
}

#[derive(Debug, Clone)]
pub struct EnabledPractices {
    pub practices: Vec<Practice>,
}

#[derive(Debug, Clone)]
pub struct Practice {
    pub name: String,
    pub value_type: PracticeType,
}

#[derive(Debug, Clone)]
pub enum PracticeType {
    Int,
    Time,
    Bool,
}
