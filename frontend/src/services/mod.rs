use crate::error::Error;
use crate::model::{LoginInfoWrapper, UserInfoWrapper};

use self::requests::request_post;

mod requests;

/// Login a user
pub async fn login(login_info: LoginInfoWrapper) -> Result<UserInfoWrapper, Error> {
    request_post("/users/login".to_string(), login_info).await
}
