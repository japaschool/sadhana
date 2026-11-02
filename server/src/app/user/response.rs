use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::model::{Confirmation, User};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserResponse {
    pub user: AuthUser,
}

impl From<(User, String)> for UserResponse {
    fn from((user, token): (User, String)) -> Self {
        Self {
            user: AuthUser {
                id: user.id,
                email: user.email,
                token,
                name: user.name,
                created: None,
            },
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AuthUser {
    pub id: Uuid,
    pub email: String,
    pub token: String,
    pub name: String,
    /// Set by Google sign-in only: whether this call made the account.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created: Option<bool>,
}

#[derive(Serialize)]
pub struct ConfirmationResponse {
    confirmation: Confirmation,
}

impl From<Confirmation> for ConfirmationResponse {
    fn from(confirmation: Confirmation) -> Self {
        Self { confirmation }
    }
}
