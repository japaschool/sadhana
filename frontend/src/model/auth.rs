use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

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
