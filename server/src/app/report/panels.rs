//! The "panels" report format, stored as JSON in `reports.definition`.
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db_types::BarLayout;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PanelsReport {
    pub version: u32,
    pub template: Option<Template>,
    /// Practices the report can't work without. `label` names the form field for the missing-practice message.
    pub required: Vec<Required>,
    pub panels: Vec<Panel>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Required {
    pub practice: Uuid,
    pub label: Label,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Template {
    Sleep(SleepTemplate),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SleepTemplate {
    pub bedtime: Uuid,
    pub wake: Uuid,
    pub nap: Option<Uuid>,
    pub min: Option<i32>,
    pub max: Option<i32>,
}

/// Key: translated at display, so shared pages follow the viewer's language. Text: a user's own words.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Label {
    Key(String),
    Text(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", deny_unknown_fields)]
pub enum Panel {
    Stats { stats: Vec<Stat> },
    Chart(ChartPanel),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ChartPanel {
    pub title: Option<Label>,
    pub series: Vec<Series>,
    pub bar_layout: BarLayout,
    pub format: Format,
    pub reversed: bool,
    pub target: Option<Target>,
    pub lines: Vec<RefLine>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Series {
    /// None = the practice's name.
    pub label: Option<Label>,
    pub mark: Mark,
    pub source: Source,
    pub axis: Side,
    /// Index of a series this one is drawn beside: no value there, no value here (a nap on a night with no bar).
    pub only_with: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Mark {
    Bar,
    Line,
    Dot,
    Range,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Side {
    Left,
    Right,
}

/// NoonClock: minutes after the noon before the night.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Format {
    Duration,
    Count,
    NoonClock,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum Source {
    Practice { practice: Uuid },
    Calc { terms: Vec<Term> },
    Range { from: Ref, to: Ref },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ref {
    pub practice: Uuid,
    pub day_offset: i32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Term {
    pub sign: i8,
    pub practice: Uuid,
    pub day_offset: i32,
    pub optional: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Target {
    pub min: Option<i32>,
    pub max: Option<i32>,
    pub of: Source,
    pub lines: bool,
    pub colour: bool,
    pub label: Option<Label>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RefLine {
    pub of: Source,
    pub pick: Option<End>,
    pub dashed: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum End {
    From,
    To,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Stat {
    pub label: Label,
    pub value: StatValue,
    pub under: Option<Box<Stat>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub enum StatValue {
    Average {
        of: Source,
        pick: Option<End>,
        format: Format,
        scope: Scope,
    },
    OnTarget {
        of: Source,
        min: Option<i32>,
        max: Option<i32>,
        scope: Scope,
    },
    Logged {
        of: Source,
        scope: Scope,
    },
    CountTrue {
        of: Source,
        scope: Scope,
    },
}

/// Sleep: today in, missing skipped. Japa and Duration: today out, missing counts as 0.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub today: bool,
    pub missing_zero: bool,
}
