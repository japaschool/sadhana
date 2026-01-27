use chrono::NaiveDate;
use common::{ReportDuration, error::AppError};
use serde::{Deserialize, Serialize};

use crate::{
    model::ReportData,
    routes::charts::{Report, ReportForm},
};

use super::requests::*;

/// Get chart data for a practice
pub fn get_report_data(cob: &NaiveDate, duration: &ReportDuration) -> GetApiRequest<ReportData> {
    request_api_get(format!("/diary/{cob}/report?duration={duration}"))
}

/// Get shared chart data for a practice
pub fn get_shared_report_data(
    user_id: &str,
    end_date: &NaiveDate,
    duration: &ReportDuration,
) -> GetApiRequest<ReportData> {
    request_api_get(format!(
        "/share/{user_id}?end_date={end_date}&duration={duration}"
    ))
}

pub fn get_reports() -> GetApiRequest<ReportsResponse> {
    request_api_get("/reports")
}

pub async fn create_new_report(report: ReportForm) -> Result<CreateReportResponse, AppError> {
    request_api_post("/reports", &CreateReportForm { report }).await
}

pub async fn update_report(report_id: &str, report: ReportForm) -> Result<(), AppError> {
    request_api_put(
        &format!("/report/{report_id}"),
        &UpdateReportForm { report },
    )
    .await
}

pub async fn delete_report(report_id: &str) -> Result<(), AppError> {
    request_api_delete(&format!("/report/{report_id}")).await
}

pub fn get_shared_reports(user_id: &str) -> GetApiRequest<ReportsResponse> {
    request_api_get(format!("/share/{user_id}/reports").to_string())
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
