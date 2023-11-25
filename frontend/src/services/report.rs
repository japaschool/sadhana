use common::error::AppError;
use serde::{Deserialize, Serialize};

use crate::routes::charts::{Report, ReportForm};

use super::requests::*;

pub async fn get_reports() -> Result<ReportsResponse, AppError> {
    request_get("/reports".to_string()).await
}

pub async fn create_new_report(report: ReportForm) -> Result<CreateReportResponse, AppError> {
    request_post("/reports".to_string(), &CreateReportForm { report }).await
}

pub async fn update_report(report_id: &str, report: ReportForm) -> Result<(), AppError> {
    request_put(format!("/report/{report_id}"), &UpdateReportForm { report }).await
}

pub async fn delete_report(report_id: &str) -> Result<(), AppError> {
    request_delete(format!("/report/{report_id}")).await
}

#[derive(Debug, Deserialize)]
pub struct ReportsResponse {
    pub reports: Vec<Report>,
}

#[derive(Debug, Deserialize)]
pub struct CreateReportResponse {
    pub report_id: String,
}

#[derive(Debug, Serialize)]
pub struct CreateReportForm {
    pub report: ReportForm,
}

#[derive(Debug, Serialize)]
pub struct UpdateReportForm {
    pub report: ReportForm,
}
