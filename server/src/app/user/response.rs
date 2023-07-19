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
