use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Signup {
    pub user: SignupUser,
    //TODO: use confirmation id to validate email before registering a new user
    // pub confirmation_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SendSignupLink {
    pub email: String,
}

#[derive(Clone, Deserialize, Serialize, Debug, Validate)]
pub struct SignupUser {
    #[validate(email(message = "email is malformed"))]
    pub email: String,
    #[validate(length(min = 5, message = "password must be at least 5 symbols long"))]
    pub password: String,
    #[validate(length(min = 3, message = "name must be at least 3 letters long"))]
    pub name: String,
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
