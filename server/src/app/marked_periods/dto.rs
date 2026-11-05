use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MarkedPeriod {
    pub id: Uuid,
    pub name: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub exclude_from_usual: bool,
}

#[derive(Debug, Serialize)]
pub struct PeriodsResponse {
    pub periods: Vec<MarkedPeriod>,
}

#[derive(Debug, Serialize)]
pub struct CreatedPeriod {
    pub id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct MarkedPeriodForm {
    pub name: String,
    pub start_date: NaiveDate,
    pub end_date: Option<NaiveDate>,
    pub exclude_from_usual: bool,
}
