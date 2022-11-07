use chrono::{Date, Local};

use crate::error::Error;
use crate::model::{JournalEntry, LoginInfoWrapper, RegisterInfoWrapper, UserInfoWrapper};

use self::requests::*;

pub mod requests;

/// Login a user
pub async fn login(login_info: LoginInfoWrapper) -> Result<UserInfoWrapper, Error> {
    request_post("/users/login".to_string(), login_info).await
}

/// Register a user
pub async fn register(register_info: RegisterInfoWrapper) -> Result<UserInfoWrapper, Error> {
    request_post("/users".to_string(), register_info).await
}

/// Get current user info
pub async fn current() -> Result<UserInfoWrapper, Error> {
    request_get::<UserInfoWrapper>("/user".to_string()).await
}

/// Get journal data for a date
pub async fn fetch(date: &Date<Local>) -> Result<JournalEntry, Error> {
    // FIXME: remove stub
    log::debug!("Fetching journal entry for {}", date);
    Ok(JournalEntry {
        rounds_before_7: 2,
        rounds_total: 16,
    })
}
