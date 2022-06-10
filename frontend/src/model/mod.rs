use serde::{Deserialize, Serialize};

//FIXME: factor out to model into a separate crate to be used by both frontend and backend
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct UserInfo {
    pub email: String,
    pub token: String,
    pub name: String,
}

impl UserInfo {
    pub fn is_authenticated(&self) -> bool {
        !self.token.is_empty()
    }
}
