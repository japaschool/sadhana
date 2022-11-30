use std::collections::HashMap;

use chrono::{Date, Local};
use common::error::AppError;

use crate::model::{
    JournalEntry, LoginInfoWrapper, PracticeEntryValue, RegisterInfoWrapper, UserInfoWrapper,
};

use self::requests::*;

pub mod requests;

/// Login a user
pub async fn login(login_info: LoginInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_post("/users/login".to_string(), login_info).await
}

/// Register a user
pub async fn register(register_info: RegisterInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_post("/users".to_string(), register_info).await
}

/// Get current user info
pub async fn current() -> Result<UserInfoWrapper, AppError> {
    request_get("/user".to_string()).await
}

/// Get diary data for a date
pub async fn fetch(date: &Date<Local>) -> Result<JournalEntry, AppError> {
    log::debug!("Fetching journal entry for {}", date);
    // request_get(format!("/diary?date={}", date.format("%F"))).await
    // FIXME: remove stub
    Ok(JournalEntry {
        values: HashMap::from([
            ("Total Rounds".to_string(), PracticeEntryValue::Int(16)),
            (
                "Wake Up Time".to_string(),
                PracticeEntryValue::Time { h: 5, m: 10 },
            ),
            ("Настройка".to_string(), PracticeEntryValue::Bool(true)),
        ]),
    })
}
