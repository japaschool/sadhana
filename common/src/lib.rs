use std::{fmt, str::FromStr};

use serde::Deserialize;

#[macro_use]
extern crate log;

pub mod error;

#[derive(Debug, PartialEq, Deserialize, Clone)]
pub enum ReportDuration {
    Last30Days,
    Last90Days,
    Last365Days,
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
            "Last30Days" => Ok(ReportDuration::Last30Days),
            "Last90Days" => Ok(ReportDuration::Last90Days),
            "Last365Days" => Ok(ReportDuration::Last365Days),
            _ => Err(()),
        }
    }
}
