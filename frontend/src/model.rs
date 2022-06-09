use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
//FIXME: factor out to model into a separate crate to be used by both frontend and backend
pub struct User {
    email: String,
    pwd: String,
    name: String,
}
