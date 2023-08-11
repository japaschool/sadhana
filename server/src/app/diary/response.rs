use super::model::{DiaryDayEntry, ReportEntry};
use chrono::NaiveDate;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct DiaryDayResponse {
    pub diary_day: Vec<DiaryDayEntry>,
    pub cob_date: NaiveDate,
}

impl From<(NaiveDate, Vec<DiaryDayEntry>)> for DiaryDayResponse {
    fn from(cob_and_entries: (NaiveDate, Vec<DiaryDayEntry>)) -> Self {
        let (cob_date, diary_day) = cob_and_entries;
        Self {
            diary_day,
            cob_date,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct ReportResponse {
    pub values: Vec<ReportEntry>,
}

impl From<Vec<ReportEntry>> for ReportResponse {
    fn from(values: Vec<ReportEntry>) -> Self {
        Self { values }
    }
}

#[derive(Serialize, Debug)]
pub struct IncompleteDays {
    pub days: Vec<NaiveDate>,
}
