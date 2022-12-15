use super::model::DiaryDayEntry;
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
