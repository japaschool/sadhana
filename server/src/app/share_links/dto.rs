use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ShareLink {
    pub id: Uuid,
    pub name: String,
    pub start_date: Option<NaiveDate>,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub report_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ShareableReport {
    pub id: Uuid,
    pub name: String,
    /// "Graph", "Grid" or "Panels".
    pub kind: &'static str,
    /// Practice names, in the user's practice order.
    pub practices: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ShareLinksResponse {
    pub links: Vec<ShareLink>,
    pub reports: Vec<ShareableReport>,
    pub legacy_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct ShareLinkForm {
    pub name: String,
    pub start_date: Option<NaiveDate>,
    pub report_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct CreatedShareLink {
    pub id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct LegacyShareForm {
    pub enabled: bool,
}
