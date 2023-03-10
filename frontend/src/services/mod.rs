use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};

use crate::model::{
    AllUserPractices, CreateUserPractice, DiaryDay, LoginInfoWrapper, RegisterInfoWrapper,
    ReportData, SendSignupLink, SignupLinkDetailsWrapper, UpdateUserPractice,
    UpdateUserPracticesOrderKey, UserInfoWrapper, UserPractice,
};

use self::requests::*;

pub mod requests;

/// Login a user
pub async fn login(login_info: LoginInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_post("/users/login".to_string(), login_info).await
}

/// Send registration form link email
pub async fn send_signup_link(payload: SendSignupLink) -> Result<(), AppError> {
    request_post("/users/signup_link".to_string(), payload).await
}

/// Get details by signup link id
pub async fn get_signup_link_details(id: &str) -> Result<SignupLinkDetailsWrapper, AppError> {
    request_get(format!("/users/signup_link/{}", id)).await
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
pub async fn get_diary_day(date: &NaiveDate) -> Result<DiaryDay, AppError> {
    log::debug!("Fetching journal entry for {}", date);
    request_get(format!("/diary?cob_date={}", date.format("%F"))).await
}

/// Save all diary entries for a date
pub async fn save_diary(data: DiaryDay) -> Result<(), AppError> {
    log::debug!("Saving diary day: {:?}", data);
    request_post("/diary".into(), data).await
}

/// Get user practices
pub async fn get_user_practices() -> Result<AllUserPractices, AppError> {
    request_get("/user/practices".to_string()).await
}

/// Updates a user practice
pub async fn update_user_practice(
    practice: &str,
    user_practice: UserPractice,
) -> Result<(), AppError> {
    request_put(
        format!("/user/practice/{}", practice),
        &UpdateUserPractice { user_practice },
    )
    .await
}

/// Reorder user practices
pub async fn reorder_user_practices(practices: Vec<String>) -> Result<(), AppError> {
    request_put(
        "/user/practices/reorder".to_string(),
        UpdateUserPracticesOrderKey { practices },
    )
    .await
}

/// Delete user practice
pub async fn delete_user_practice(practice: &str) -> Result<(), AppError> {
    request_delete(format!("/user/practice/{}", practice)).await
}

/// Create a new user practice
pub async fn create_user_practice(user_practice: UserPractice) -> Result<(), AppError> {
    request_post(
        "/user/practices".to_string(),
        &CreateUserPractice { user_practice },
    )
    .await
}

/// Get chart data for a practice
pub async fn get_chart_data(
    practice: &str,
    duration: &ReportDuration,
) -> Result<ReportData, AppError> {
    request_get(format!("/diary/report?practice={}&duration={}", practice, duration).to_string())
        .await
}
