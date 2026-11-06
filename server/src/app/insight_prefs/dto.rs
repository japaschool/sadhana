use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct PrefsBody {
    pub prefs: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct PrefsResponse {
    pub prefs: Option<serde_json::Value>,
}
