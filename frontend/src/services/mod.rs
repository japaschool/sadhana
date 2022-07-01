use crate::error::Error;
use crate::model::{LoginInfoWrapper, RegisterInfoWrapper, UserInfoWrapper};

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
