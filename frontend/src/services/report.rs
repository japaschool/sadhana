use chrono::NaiveDate;
use common::{error::AppError, ReportDuration};
use serde::{Deserialize, Serialize};

use crate::{
    model::ReportData,
    routes::charts::{Report, ReportForm},
};

use super::requests::*;

/// Get chart data for a practice
pub async fn get_report_data(
    cob: &NaiveDate,
    duration: &ReportDuration,
) -> Result<ReportData, AppError> {
    request_get(format!("/diary/{cob}/report?duration={duration}").to_string()).await
}

/// Get shared chart data for a practice
pub async fn get_shared_report_data(
    user_id: &str,
    duration: &ReportDuration,
) -> Result<ReportData, AppError> {
    request_get(format!("/share/{user_id}?duration={duration}").to_string()).await
}

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

pub async fn get_shared_reports(user_id: &str) -> Result<ReportsResponse, AppError> {
    request_get(format!("/share/{user_id}/reports").to_string()).await
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
