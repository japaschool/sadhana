use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Signup {
    pub user: SignupUser,
}

#[derive(Clone, Deserialize, Serialize, Debug, Validate)]
pub struct SignupUser {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 5))]
    pub password: String,
    #[validate(length(min = 3))]
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
