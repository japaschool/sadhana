use chrono::{Datelike, NaiveDate};

pub trait DateExt {
    fn start_of_week(self) -> NaiveDate;
    fn start_of_month(self) -> NaiveDate;
    fn start_of_quarter(self) -> NaiveDate;
    fn start_of_year(self) -> NaiveDate;
}

impl DateExt for NaiveDate {
    fn start_of_week(self) -> NaiveDate {
        self - chrono::Duration::days(self.weekday().num_days_from_monday() as i64)
    }

    fn start_of_month(self) -> NaiveDate {
        NaiveDate::from_ymd_opt(self.year(), self.month(), 1).unwrap()
    }

    fn start_of_quarter(self) -> NaiveDate {
        let m = ((self.month() - 1) / 3) * 3 + 1;
        NaiveDate::from_ymd_opt(self.year(), m, 1).unwrap()
    }

    fn start_of_year(self) -> NaiveDate {
        NaiveDate::from_ymd_opt(self.year(), 1, 1).unwrap()
    }
}
