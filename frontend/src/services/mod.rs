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
    request_api_get(&format!("/users/confirmation/{}", id)).await
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
pub async fn current() -> Result<UserInfoWrapper, AppError> {
    request_api_get("/user").await
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
pub async fn get_diary_day(date: &NaiveDate) -> Result<DiaryDay, AppError> {
    log::debug!("Fetching journal entry for {}", date);
    request_api_get(&format!("/diary/{}", date.format("%F"))).await
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
pub async fn get_incomplete_days(
    from: &NaiveDate,
    to: &NaiveDate,
) -> Result<IncompleteDays, AppError> {
    request_api_get(&format!(
        "/diary/incomplete-days?from={}&to={}",
        from.format("%F"),
        to.format("%F")
    ))
    .await
}

/// Get user practice
pub async fn get_user_practice(id: &str) -> Result<GetUserPractice, AppError> {
    request_api_get(&format!("/user/practice/{id}")).await
}

/// Get user practices
pub async fn get_user_practices() -> Result<AllUserPractices, AppError> {
    request_api_get("/user/practices").await
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
pub async fn get_shared_practices(user_id: &str) -> Result<AllUserPractices, AppError> {
    request_api_get(&format!("/share/{user_id}/practices")).await
}

pub async fn user_info(user_id: &str) -> Result<UserInfoWrapper, AppError> {
    request_api_get(&format!("/share/{user_id}/user")).await
}

/// Get yatra data
pub async fn get_yatra_data(yatra_id: &str, cob_date: &NaiveDate) -> Result<YatraData, AppError> {
    request_api_get(&format!(
        "/yatra/{yatra_id}/data?cob_date={}",
        cob_date.format("%F")
    ))
    .await
}

/// Get user yatras
pub async fn get_user_yatras() -> Result<Yatras, AppError> {
    request_api_get("/yatras").await
}

/// Create a new yatra
pub async fn get_yatra(yatra_id: &str) -> Result<YatraResponse, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}")).await
}

/// Join yatra
pub async fn join_yatra(yatra_id: &str) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}/join"), &()).await
}

/// Leave yatra
pub async fn leave_yatra(yatra_id: &str) -> Result<(), AppError> {
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

/// Rename yatra
pub async fn rename_yatra(yatra_id: &str, name: String) -> Result<(), AppError> {
    request_api_put(&format!("/yatra/{yatra_id}"), &RenameYatra { name }).await
}

/// Check is_admin flag
pub async fn is_yatra_admin(yatra_id: &str) -> Result<IsYatraAdminResponse, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}/is_admin")).await
}

/// Get yatra practices
pub async fn get_yatra_practices(yatra_id: &str) -> Result<YatraPractices, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}/practices")).await
}

/// Get yatra practice
pub async fn get_yatra_practice(
    yatra_id: &str,
    practice_id: &str,
) -> Result<GetYatraPractice, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}/practice/{practice_id}")).await
}

/// Get yatra users
pub async fn get_yatra_users(yatra_id: &str) -> Result<YatraUsers, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}/users")).await
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
pub async fn get_yatra_user_practices(yatra_id: &str) -> Result<YatraUserPractices, AppError> {
    request_api_get(&format!("/yatra/{yatra_id}/user-practices")).await
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

//TODO:  This is unused now
pub async fn get_build_info() -> Result<BuildInfo, AppError> {
    request_get("/build_info.json").await
}
