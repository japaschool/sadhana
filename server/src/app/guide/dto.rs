use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::domain::{Outcome, StartedFrom};

#[derive(Debug, Deserialize)]
pub struct StartForm {
    pub started_from: StartedFrom,
}

#[derive(Debug, Serialize)]
pub struct Started {
    pub id: Uuid,
}

#[derive(Debug, Default, Deserialize)]
pub struct UpdateForm {
    pub last_step: Option<String>,
    pub outcome: Option<Outcome>,
    pub has_reader: Option<bool>,
}
