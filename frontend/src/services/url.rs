use chrono::NaiveDate;
use common::ReportDuration;

pub fn get_diary_day(date: &NaiveDate) -> String {
    format!("/diary/{}", date.format("%F"))
}

pub fn get_report_data(cob: &NaiveDate, duration: &ReportDuration) -> String {
    format!("/diary/{cob}/report?duration={duration}")
}

pub fn get_yatra_data(yatra_id: &str, cob_date: &NaiveDate) -> String {
    format!("/yatra/{yatra_id}/data?cob_date={}", cob_date.format("%F"))
}

pub const GET_USER_PRACTICES: &str = "/user/practices";
pub const GET_REPORTS: &str = "/reports";
