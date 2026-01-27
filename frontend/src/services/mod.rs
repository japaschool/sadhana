use chrono::NaiveDate;
use common::error::AppError;

use crate::model::*;

use self::requests::*;

pub mod report;
pub mod requests;

/// Login a user
pub async fn login(login_info: &LoginInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_api_post("/users/login", login_info).await
}

/// Send registration form link email
pub async fn send_confirmation_link(data: SendConfirmationLink) -> Result<(), AppError> {
    request_api_post("/users/confirmation", &SendConfirmationLinkWrapper { data }).await
}

/// Get details by signup link id
pub async fn get_signup_link_details(id: &str) -> Result<SignupLinkDetailsWrapper, AppError> {
    request_api_get_no_cache(&format!("/users/confirmation/{}", id)).await
}

/// Register a user
pub async fn register(register_info: RegisterInfoWrapper) -> Result<UserInfoWrapper, AppError> {
    request_api_post("/users", &register_info).await
}

/// Reset password
pub async fn reset_pwd(data: ResetPassword) -> Result<(), AppError> {
    request_api_put("/password-reset", &ResetPasswordWrapper { data }).await
}

/// Get current user info
pub fn current() -> GetApiRequest<UserInfoWrapper> {
    request_api_get("/user")
}

/// Update user
pub async fn update_user(user: UpdateUser) -> Result<(), AppError> {
    request_api_put("/user", &UpdateUserWrapper { user }).await
}

/// Update user password
pub async fn update_user_password(
    current_password: &str,
    new_password: &str,
) -> Result<(), AppError> {
    request_api_put(
        "/user/password",
        &UpdateUserPassword {
            current_password: current_password.to_owned(),
            new_password: new_password.to_owned(),
        },
    )
    .await
}

/// Get diary data for a date
pub fn get_diary_day(date: &NaiveDate) -> GetApiRequest<DiaryDay> {
    request_api_get(format!("/diary/{}", date.format("%F")))
}

/// Save a diary entry for a date
pub async fn save_diary_entry(cob: &NaiveDate, entry: &DiaryEntry) -> Result<(), AppError> {
    log::debug!("Saving diary day entry: {:?}", entry);
    request_api_put(
        &format!("/diary/{}/entry", cob.format("%F")),
        &SaveDiaryDayEntry { entry },
    )
    .await
}

/// Save all diary entries for a date
pub async fn save_diary_owned(cob: &NaiveDate, data: DiaryDay) -> Result<(), AppError> {
    log::debug!("Saving diary day: {:?}", data);
    request_api_put(&format!("/diary/{}", cob.format("%F")), &data).await
}

/// Gets incomplete days between passed dates
pub fn get_incomplete_days(from: &NaiveDate, to: &NaiveDate) -> GetApiRequest<IncompleteDays> {
    request_api_get(format!(
        "/diary/incomplete-days?from={}&to={}",
        from.format("%F"),
        to.format("%F")
    ))
}

/// Get user practice
pub fn get_user_practice(id: &str) -> GetApiRequest<GetUserPractice> {
    request_api_get(format!("/user/practice/{id}"))
}

/// Get user practices
pub fn get_user_practices() -> GetApiRequest<AllUserPractices> {
    request_api_get("/user/practices")
}

/// Updates a user practice
pub async fn update_user_practice(user_practice: &UserPractice) -> Result<(), AppError> {
    request_api_put(
        &format!("/user/practice/{}", user_practice.id),
        &UpdateUserPractice { user_practice },
    )
    .await
}

/// Reorder user practices
pub async fn reorder_user_practices(practices: &Vec<String>) -> Result<(), AppError> {
    request_api_put(
        "/user/practices/reorder",
        &UpdateUserPracticesOrderKey { practices },
    )
    .await
}

/// Delete user practice
pub async fn delete_user_practice(practice: &str) -> Result<(), AppError> {
    request_api_delete(&format!("/user/practice/{practice}")).await
}

/// Create a new user practice
pub async fn create_user_practice(user_practice: NewUserPractice) -> Result<(), AppError> {
    request_api_post("/user/practices", &CreateUserPractice { user_practice }).await
}

/// Get shared practices
pub fn get_shared_practices(user_id: &str) -> GetApiRequest<AllUserPractices> {
    request_api_get(format!("/share/{user_id}/practices"))
}

pub fn user_info(user_id: &str) -> GetApiRequest<UserInfoWrapper> {
    request_api_get(format!("/share/{user_id}/user"))
}

/// Get yatra data
pub fn get_yatra_data(yatra_id: &str, cob_date: &NaiveDate) -> GetApiRequest<YatraData> {
    request_api_get(format!(
        "/yatra/{yatra_id}/data?cob_date={}",
        cob_date.format("%F")
    ))
}

/// Get user yatras
pub fn get_user_yatras() -> GetApiRequest<Yatras> {
    request_api_get("/yatras")
}

/// Create a new yatra
pub fn get_yatra(yatra_id: &str) -> GetApiRequest<YatraResponse> {
    request_api_get(format!("/yatra/{yatra_id}"))
}

/// Join yatra
pub async fn join_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}/join"), &()).await
}

/// Leave yatra
pub async fn yatra_leave(yatra_id: &str) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}/leave"), &()).await
}

/// Create a new yatra
pub async fn create_yatra(name: String) -> Result<YatraResponse, AppError> {
    request_api_post("/yatras", &CreateYatra { name }).await
}

/// Delete yatra
pub async fn delete_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_api_delete(&format!("/yatra/{yatra_id}")).await
}

/// Update yatra
pub async fn update_yatra(yatra_id: &str, yatra: Yatra) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}"), &UpdateYatra { yatra }).await
}

/// Check is_admin flag
pub fn is_yatra_admin(yatra_id: &str) -> GetApiRequest<IsYatraAdminResponse> {
    request_api_get(format!("/yatra/{yatra_id}/is_admin"))
}

/// Get yatra practices
pub fn get_yatra_practices(yatra_id: &str) -> GetApiRequest<YatraPractices> {
    request_api_get(format!("/yatra/{yatra_id}/practices"))
}

/// Get yatra practice
pub fn get_yatra_practice(yatra_id: &str, practice_id: &str) -> GetApiRequest<GetYatraPractice> {
    request_api_get(format!("/yatra/{yatra_id}/practice/{practice_id}"))
}

/// Get yatra users
pub fn get_yatra_users(yatra_id: &str) -> GetApiRequest<YatraUsers> {
    request_api_get(format!("/yatra/{yatra_id}/users"))
}

/// Delete yatra user
pub async fn delete_yatra_user(yatra_id: &str, user_id: &str) -> Result<(), AppError> {
    request_api_delete(&format!("/yatra/{yatra_id}/users/{user_id}")).await
}

/// Toggle is_admin flag for a yatra user
pub async fn toggle_is_admin_yatra_user(yatra_id: &str, user_id: &str) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}/users/{user_id}/is_admin"), &()).await
}

/// Reorder yatra practices
pub async fn reorder_yatra_practices(
    yatra_id: &str,
    practices: Vec<String>,
) -> Result<(), AppError> {
    request_api_put(
        &format!("/yatra/{yatra_id}/practices/reorder"),
        &UpdateYatraPracticesOrderKey { practices },
    )
    .await
}

/// Create a new yatra practice
pub async fn create_yatra_practice(
    yatra_id: &str,
    practice: NewYatraPractice,
) -> Result<(), AppError> {
    request_api_post(
        &format!("/yatra/{yatra_id}/practices"),
        &CreateYatraPractice { practice },
    )
    .await
}

/// Delete yatra practice
pub async fn delete_yatra_practice(yatra_id: &str, practice_id: &str) -> Result<(), AppError> {
    request_api_delete(&format!("/yatra/{yatra_id}/practice/{practice_id}")).await
}

/// Update yatra practice
pub async fn update_yatra_practice(
    yatra_id: &str,
    practice: &YatraPractice,
) -> Result<(), AppError> {
    request_api_put(
        &format!("/yatra/{yatra_id}/practice/{}", practice.id),
        &UpdateYatraPractice { practice },
    )
    .await
}

/// Get yatra user practices mapping
pub fn get_yatra_user_practices(yatra_id: &str) -> GetApiRequest<YatraUserPractices> {
    request_api_get(format!("/yatra/{yatra_id}/user-practices"))
}

pub async fn update_yatra_user_practices(
    yatra_id: &str,
    practices: &[YatraUserPractice],
) -> Result<(), AppError> {
    request_api_put(
        &format!("/yatra/{yatra_id}/user-practices"),
        &YatraUserPractices {
            practices: practices.to_vec(),
        },
    )
    .await
}

pub async fn send_support_message(subject: &str, message: &str) -> Result<(), AppError> {
    request_api_post("/support-form", &SupportMessageForm::new(subject, message)).await
}

pub fn get_version() -> GetApiRequest<ApiVersion> {
    request_api_get("/version")
}
