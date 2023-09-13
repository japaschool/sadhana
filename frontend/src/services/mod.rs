use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use urlencoding::encode; //FIXME: should be gone

use crate::model::*;

use self::requests::*;

pub mod requests;

/// Login a user
pub async fn login(login_info: &LoginInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_post("/users/login".to_string(), login_info).await
}

/// Send registration form link email
pub async fn send_confirmation_link(data: SendConfirmationLink) -> Result<(), AppError> {
    request_post(
        "/users/confirmation".to_string(),
        &SendConfirmationLinkWrapper { data },
    )
    .await
}

/// Get details by signup link id
pub async fn get_signup_link_details(id: &str) -> Result<SignupLinkDetailsWrapper, AppError> {
    request_get(format!("/users/confirmation/{}", id)).await
}

/// Register a user
pub async fn register(register_info: RegisterInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_post("/users".to_string(), &register_info).await
}

/// Reset password
pub async fn reset_pwd(data: ResetPassword) -> Result<(), AppError> {
    request_put(
        "/password-reset".to_string(),
        &ResetPasswordWrapper { data },
    )
    .await
}

/// Get current user info
pub async fn current() -> Result<UserInfoWrapper, AppError> {
    request_get("/user".to_string()).await
}

/// Update user
pub async fn update_user(user: UpdateUser) -> Result<(), AppError> {
    request_put("/user".to_string(), &UpdateUserWrapper { user }).await
}

/// Update user password
pub async fn update_user_password(
    current_password: &str,
    new_password: &str,
) -> Result<(), AppError> {
    request_put(
        "/user/password".to_string(),
        &UpdateUserPassword {
            current_password: current_password.to_owned(),
            new_password: new_password.to_owned(),
        },
    )
    .await
}

/// Get diary data for a date
pub async fn get_diary_day(date: &NaiveDate) -> Result<DiaryDay, AppError> {
    log::debug!("Fetching journal entry for {}", date);
    request_get(format!("/diary/{}", date.format("%F"))).await
}

/// Save all diary entries for a date
//TODO: remove if no longer required from both frontend & backend
pub async fn save_diary(cob: &NaiveDate, data: &SaveDiaryDay<'_>) -> Result<(), AppError> {
    log::debug!("Saving diary day: {:?}", data);
    request_put(format!("/diary/{}", cob.format("%F")), data).await
}

/// Save a diary entry for a date
pub async fn save_diary_entry(cob: &NaiveDate, entry: &DiaryEntry) -> Result<(), AppError> {
    log::debug!("Saving diary day entry: {:?}", entry);
    request_put(
        format!("/diary/{}/entry", cob.format("%F")),
        &SaveDiaryDayEntry { entry },
    )
    .await
}

/// Save all diary entries for a date
pub async fn save_diary_owned(cob: &NaiveDate, data: DiaryDay) -> Result<(), AppError> {
    log::debug!("Saving diary day: {:?}", data);
    request_put(format!("/diary/{}", cob.format("%F")), &data).await
}

/// Gets incomplete days for the week the date is in
pub async fn get_incomplete_days(date: &NaiveDate) -> Result<IncompleteDays, AppError> {
    request_get(format!("/diary/{}/incomplete-days", date.format("%F"))).await
}

/// Get user practice
pub async fn get_user_practice(practice: &str) -> Result<GetUserPractice, AppError> {
    request_get(format!("/user/practice/{practice}")).await
}

/// Get user practices
pub async fn get_user_practices() -> Result<AllUserPractices, AppError> {
    request_get("/user/practices".to_string()).await
}

/// Updates a user practice
pub async fn update_user_practice(user_practice: &UserPractice) -> Result<(), AppError> {
    request_put(
        format!("/user/practice/{}", user_practice.id),
        &UpdateUserPractice { user_practice },
    )
    .await
}

/// Reorder user practices
pub async fn reorder_user_practices(practices: &Vec<String>) -> Result<(), AppError> {
    request_put(
        "/user/practices/reorder".to_string(),
        &UpdateUserPracticesOrderKey { practices },
    )
    .await
}

/// Delete user practice
pub async fn delete_user_practice(practice: &str) -> Result<(), AppError> {
    request_delete(format!("/user/practice/{practice}")).await
}

/// Create a new user practice
pub async fn create_user_practice(user_practice: NewUserPractice) -> Result<(), AppError> {
    request_post(
        "/user/practices".to_string(),
        &CreateUserPractice { user_practice },
    )
    .await
}

/// Get chart data for a practice
pub async fn get_chart_data(
    cob: &NaiveDate,
    practice: &Option<String>,
    duration: &ReportDuration,
) -> Result<ReportData, AppError> {
    let mut query = format!("duration={duration}");
    if let Some(p) = practice {
        query.push_str(&format!("&practice={}", encode(p)));
    }
    request_get(format!("/diary/{cob}/report?{query}").to_string()).await
}

/// Get shared chart data for a practice
pub async fn get_shared_chart_data(
    user_id: &str,
    practice: &str,
    duration: &ReportDuration,
) -> Result<ReportData, AppError> {
    request_get(
        format!(
            "/share/{user_id}?practice={}&duration={duration}",
            encode(practice)
        )
        .to_string(),
    )
    .await
}

/// Get shared practices
pub async fn get_shared_practices(user_id: &str) -> Result<AllUserPractices, AppError> {
    request_get(format!("/share/{user_id}/practices").to_string()).await
}

pub async fn user_info(user_id: &str) -> Result<UserInfoWrapper, AppError> {
    request_get(format!("/share/{user_id}/user")).await
}

/// Get yatra data
pub async fn get_yatra_data(yatra_id: &str, cob_date: &NaiveDate) -> Result<YatraData, AppError> {
    request_get(format!("/yatra/{yatra_id}/data?cob_date={}", cob_date.format("%F")).to_string())
        .await
}

/// Get user yatras
pub async fn get_user_yatras() -> Result<Yatras, AppError> {
    request_get("/yatras".to_string()).await
}

/// Create a new yatra
pub async fn get_yatra(yatra_id: &str) -> Result<YatraResponse, AppError> {
    request_get(format!("/yatra/{yatra_id}")).await
}

/// Join yatra
pub async fn join_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_put(format!("/yatra/{yatra_id}/join"), &()).await
}

/// Leave yatra
pub async fn leave_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_put(format!("/yatra/{yatra_id}/leave"), &()).await
}

/// Create a new yatra
pub async fn create_yatra(name: String) -> Result<YatraResponse, AppError> {
    request_post("/yatras".to_string(), &CreateYatra { name }).await
}

/// Delete yatra
pub async fn delete_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_delete(format!("/yatra/{yatra_id}")).await
}

/// Check is_admin flag
pub async fn is_yatra_admin(yatra_id: &str) -> Result<IsYatraAdminResponse, AppError> {
    request_get(format!("/yatra/{yatra_id}/is_admin")).await
}

/// Get yatra practices
pub async fn get_yatra_practices(yatra_id: &str) -> Result<YatraPractices, AppError> {
    request_get(format!("/yatra/{yatra_id}/practices")).await
}

/// Reorder yatra practices
pub async fn reorder_yatra_practices(
    yatra_id: &str,
    practices: Vec<String>,
) -> Result<(), AppError> {
    request_put(
        format!("/yatra/{yatra_id}/practices/reorder"),
        &UpdateYatraPracticesOrderKey { practices },
    )
    .await
}

/// Create a new yatra practice
pub async fn create_yatra_practice(
    yatra_id: &str,
    practice: YatraPractice,
) -> Result<(), AppError> {
    request_post(
        format!("/yatra/{yatra_id}/practices"),
        &CreateYatraPractice { practice },
    )
    .await
}

/// Delete yatra practice
pub async fn delete_yatra_practice(yatra_id: &str, practice: &str) -> Result<(), AppError> {
    request_delete(format!("/yatra/{yatra_id}/practice/{}", encode(practice))).await
}

/// Update yatra practice
pub async fn update_yatra_practice(
    yatra_id: &str,
    practice: &str,
    new_name: &str,
) -> Result<(), AppError> {
    request_put(
        format!("/yatra/{yatra_id}/practice/{}", encode(practice)),
        &UpdateYatraPractice {
            update: YatraPracticeUpdate {
                practice: new_name.to_owned(),
            },
        },
    )
    .await
}

/// Get yatra user practices mapping
pub async fn get_yatra_user_practices(yatra_id: &str) -> Result<YatraUserPractices, AppError> {
    request_get(format!("/yatra/{yatra_id}/user-practices")).await
}

pub async fn update_yatra_user_practices(
    yatra_id: &str,
    practices: &Vec<YatraUserPractice>,
) -> Result<(), AppError> {
    request_put(
        format!("/yatra/{yatra_id}/user-practices"),
        &YatraUserPractices {
            practices: practices.clone(),
        },
    )
    .await
}
