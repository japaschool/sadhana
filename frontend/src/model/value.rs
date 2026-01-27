use std::{cmp::Ordering, fmt::Display};

use crate::tr;
use anyhow::{Context, anyhow};
use js_sys::RegExp;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Copy, Deserialize, Default)]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    #[default]
    Text,
    Duration,
}

impl PracticeDataType {
    pub fn to_localised_string(self) -> String {
        match self {
            PracticeDataType::Int => tr!(integer),
            PracticeDataType::Bool => tr!(boolean),
            PracticeDataType::Time => tr!(time),
            PracticeDataType::Text => tr!(text),
            PracticeDataType::Duration => tr!(duration),
        }
    }
}

impl Display for PracticeDataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            PracticeDataType::Int => "int",
            PracticeDataType::Bool => "bool",
            PracticeDataType::Time => "time",
            PracticeDataType::Text => "text",
            PracticeDataType::Duration => "duration",
        };
        write!(f, "{}", s)
    }
}

impl TryFrom<&str> for PracticeDataType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "int" => Ok(PracticeDataType::Int),
            "bool" => Ok(PracticeDataType::Bool),
            "time" => Ok(PracticeDataType::Time),
            "text" => Ok(PracticeDataType::Text),
            "duration" => Ok(PracticeDataType::Duration),
            _ => Err(format!("Unknown PracticeDataType value {}", value)),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Value {
    Int(u16),
    Bool(bool),
    Time { h: u8, m: u8 },
    Text(String),
    Duration(u16),
}

lazy_static! {
    static ref DURATION_R_P: String = r"(?:(\d+)[^\d]+)?(\d+)[^\d]+".to_string();
}

fn adjust_bool_str(s: &str) -> String {
    if s == "✓" {
        "true".to_string()
    } else {
        s.to_lowercase()
    }
}

impl TryFrom<(&PracticeDataType, &str)> for Value {
    type Error = anyhow::Error;

    fn try_from(value: (&PracticeDataType, &str)) -> Result<Self, Self::Error> {
        let res = match value.0 {
            PracticeDataType::Int => value
                .1
                .parse()
                .map(Value::Int)
                .with_context(|| format!("Failed to parse int from {}", value.1))?,
            PracticeDataType::Bool => adjust_bool_str(value.1)
                .parse()
                .map(Value::Bool)
                .with_context(|| format!("Failed to parse bool from {}", value.1))?,
            PracticeDataType::Time => value
                .1
                .split_once(':')
                .and_then(|(h, m)| {
                    let h = h.parse().ok()?;
                    let m = m.parse().ok()?;
                    Some(Value::Time { h, m })
                })
                .ok_or_else(|| anyhow!("Couldn't parse time from {}", value.1))?,
            PracticeDataType::Text => Value::Text(value.1.to_owned()),
            PracticeDataType::Duration => RegExp::new(&DURATION_R_P, "")
                .exec(value.1)
                .iter()
                .filter_map(|cap| {
                    cap.get(2).as_string().and_then(|m_str| {
                        m_str.parse::<u16>().ok().map(|m| {
                            Value::Duration(
                                m + 60
                                    * cap
                                        .get(1)
                                        .as_string()
                                        .and_then(|h_str| h_str.as_str().parse::<u16>().ok())
                                        .unwrap_or_default(),
                            )
                        })
                    })
                })
                .next()
                .ok_or_else(|| anyhow!("Couldn't parse duration from {}", value.1))?,
        };
        Ok(res)
    }
}

impl Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Value::Int(i) => i.to_string(),
            Value::Bool(b) => (if *b { "✓" } else { "" }).to_string(),
            Value::Time { h: _, m: _ } => self.as_time_str().unwrap(),
            Value::Text(_) => self.as_text().unwrap(),
            Value::Duration(_) => self.as_duration_str().unwrap(),
        };
        write!(f, "{}", s)
    }
}

impl Value {
    pub fn as_int(&self) -> Option<u16> {
        match self {
            &Value::Int(i) => Some(i),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            &Value::Bool(b) => Some(b),
            _ => None,
        }
    }

    pub fn as_time_str(&self) -> Option<String> {
        match self {
            &Value::Time { h, m } => {
                Some(format!("{:0width$}:{:0width$}", h, m, width = 2))
            }
            _ => None,
        }
    }

    pub fn as_duration_mins(&self) -> Option<u16> {
        match self {
            &Value::Duration(mins) => Some(mins),
            _ => None,
        }
    }

    pub fn as_duration_str(&self) -> Option<String> {
        match self {
            &Value::Duration(mins) => {
                let hours = mins / 60;
                let minutes = mins % 60;
                let res = if hours > 0 {
                    if minutes > 0 {
                        format!(
                            "{hours}{hours_label} {minutes}{minutes_label}",
                            hours = hours,
                            minutes = minutes,
                            hours_label = tr!(hours_label),
                            minutes_label = tr!(minutes_label)
                        )
                    } else {
                        format!(
                            "{hours}{hours_label}",
                            hours = hours,
                            hours_label = tr!(hours_label)
                        )
                    }
                } else {
                    format!(
                        "{minutes}{minutes_label}",
                        minutes = minutes,
                        minutes_label = tr!(minutes_label)
                    )
                };
                Some(res)
            }
            _ => None,
        }
    }

    pub fn as_text(&self) -> Option<String> {
        match &self {
            &Value::Text(s) => Some(s.clone()),
            _ => None,
        }
    }

    pub fn as_comparable(&self) -> Option<i64> {
        match self {
            Value::Int(i) => Some(i32::from(*i) as i64),
            Value::Duration(mins) => Some(i64::from(*mins) * 60),
            Value::Time { h, m } => Some(i64::from(*h) * 3600 + i64::from(*m) * 60),
            _ => None,
        }
    }
}

impl PartialOrd for Value {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        match (self.as_comparable(), other.as_comparable()) {
            (Some(a), Some(b)) => Some(a.cmp(&b)),
            _ => None,
        }
    }
}
