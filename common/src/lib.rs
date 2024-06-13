use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};

#[macro_use]
extern crate log;

pub mod error;

#[derive(Debug, PartialEq, Deserialize, Serialize, Clone)]
pub enum ReportDuration {
    Week,
    Month,
    Quarter,
    HalfYear,
    Year,
    AllData,
}

impl fmt::Display for ReportDuration {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl FromStr for ReportDuration {
    type Err = ();

    fn from_str(input: &str) -> Result<ReportDuration, Self::Err> {
        match input {
            "Week" => Ok(ReportDuration::Week),
            "Month" => Ok(ReportDuration::Month),
            "Quarter" => Ok(ReportDuration::Quarter),
            "HalfYear" => Ok(ReportDuration::HalfYear),
            "Year" => Ok(ReportDuration::Year),
            "AllData" => Ok(ReportDuration::AllData),
            _ => Err(()),
        }
    }
}
