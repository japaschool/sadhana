use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Signup {
    pub user: SignupUser,
}

#[derive(Clone, Deserialize, Serialize, Debug, Validate)]
pub struct SignupUser {
    #[validate(email(message = "email is malformed"))]
    pub email: String,
    #[validate(length(min = 5, message = "password must be at least 5 symbols long"))]
    pub password: String,
    #[validate(length(min = 3, message = "name must be at least 3 letters long"))]
    pub name: String,
    pub lang: String,
    pub confirmation_id: Uuid,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Signin {
    pub user: SigninUser,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SigninUser {
    pub email: String,
    pub password: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateUser {
    pub name: String,
}

#[derive(Deserialize, Debug)]
pub struct UpdateUserRequest {
    pub user: UpdateUser,
}

#[derive(Deserialize, Debug)]
pub struct UpdateUserPasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize, PartialEq)]
pub enum ConfirmationType {
    Registration,
    PasswordReset,
}

#[derive(Debug, Deserialize)]
pub struct SendConfirmationLink {
    pub email: String,
    pub confirmation_type: ConfirmationType,
    pub server_address: String,
}

#[derive(Debug, Deserialize)]
pub struct SendConfirmationLinkWrapper {
    pub data: SendConfirmationLink,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PwdResetWrapper {
    pub data: PwdReset,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PwdReset {
    pub confirmation_id: Uuid,
    pub password: String,
}
