//! The "panels" report format, stored as JSON in `reports.definition`.
use std::collections::HashSet;

use common::error::AppError;
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
    Japa(JapaTemplate),
    Duration(DurationTemplate),
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JapaTemplate {
    pub total: Uuid,
    pub target: i32,
    pub morning: Option<Uuid>,
    pub quality: Option<Uuid>,
    pub attunement: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DurationTemplate {
    pub practices: Vec<Uuid>,
    pub goal: Option<i32>,
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
    pub label: Option<Label>,
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

pub const MAX_PANELS: usize = 8;
pub const MAX_SERIES: usize = 12;
pub const MAX_STATS: usize = 8;
pub const MAX_TERMS: usize = 16;
pub const MAX_BYTES: usize = 32 * 1024;

fn invalid<S: Into<String>>(msg: S) -> AppError {
    AppError::UnprocessableEntity(vec![msg.into()])
}

fn check_bounds(min: Option<i32>, max: Option<i32>) -> Result<(), AppError> {
    if min.is_some_and(|v| v < 0) || max.is_some_and(|v| v < 0) {
        return Err(invalid("Target values can't be negative"));
    }
    if let (Some(min), Some(max)) = (min, max) {
        if min > max {
            return Err(invalid("Target min is above max"));
        }
    }
    Ok(())
}

impl Source {
    fn collect(&self, out: &mut HashSet<Uuid>) -> Result<(), AppError> {
        match self {
            Source::Practice { practice } => {
                out.insert(*practice);
            }
            Source::Calc { terms } => {
                if terms.len() > MAX_TERMS {
                    return Err(invalid("Too many terms"));
                }
                out.extend(terms.iter().map(|t| t.practice));
            }
            Source::Range { from, to } => {
                out.insert(from.practice);
                out.insert(to.practice);
            }
        }
        Ok(())
    }
}

impl Stat {
    fn walk(&self, out: &mut HashSet<Uuid>) -> Result<(), AppError> {
        match &self.value {
            StatValue::OnTarget { of, min, max, .. } => {
                check_bounds(*min, *max)?;
                of.collect(out)?;
            }
            StatValue::Average { of, .. }
            | StatValue::Logged { of, .. }
            | StatValue::CountTrue { of, .. } => of.collect(out)?,
        }
        if let Some(under) = &self.under {
            under.walk(out)?;
        }
        Ok(())
    }
}

impl PanelsReport {
    /// Every practice the definition refers to.
    pub fn practice_ids(&self) -> HashSet<Uuid> {
        let mut out = HashSet::new();
        // Limits are checked by `validate`; a stored definition is walked as it is.
        let _ = self.walk(&mut out);
        out
    }

    /// Checks limits and values, and that every practice is in `allowed`.
    pub fn validate(&self, allowed: &HashSet<Uuid>) -> Result<(), AppError> {
        if self.version != 1 {
            return Err(invalid("Unsupported report version"));
        }
        if self.panels.len() > MAX_PANELS {
            return Err(invalid("Too many panels"));
        }
        let size = serde_json::to_vec(self)
            .map_err(|_| invalid("Invalid definition"))?
            .len();
        if size > MAX_BYTES {
            return Err(invalid("Report definition is too large"));
        }
        let mut used = HashSet::new();
        self.walk(&mut used)?;
        if used.iter().any(|p| !allowed.contains(p)) {
            return Err(invalid("Report uses a practice that isn't yours"));
        }
        Ok(())
    }

    fn walk(&self, out: &mut HashSet<Uuid>) -> Result<(), AppError> {
        out.extend(self.required.iter().map(|r| r.practice));
        match &self.template {
            Some(Template::Sleep(s)) => {
                check_bounds(s.min, s.max)?;
                out.extend([s.bedtime, s.wake]);
                out.extend(s.nap);
            }
            Some(Template::Japa(j)) => {
                check_bounds(Some(j.target), None)?;
                out.insert(j.total);
                out.extend([j.morning, j.quality, j.attunement].into_iter().flatten());
            }
            Some(Template::Duration(d)) => {
                if d.practices.is_empty() {
                    return Err(invalid("Choose at least one practice"));
                }
                if d.practices.len() > MAX_SERIES {
                    return Err(invalid("Too many series"));
                }
                check_bounds(d.goal, None)?;
                out.extend(d.practices.iter().copied());
            }
            None => {}
        }
        for panel in &self.panels {
            match panel {
                Panel::Stats { stats } => {
                    if stats.len() > MAX_STATS {
                        return Err(invalid("Too many stats"));
                    }
                    for stat in stats {
                        stat.walk(out)?;
                    }
                }
                Panel::Chart(chart) => {
                    if chart.series.len() > MAX_SERIES {
                        return Err(invalid("Too many series"));
                    }
                    for series in &chart.series {
                        series.source.collect(out)?;
                    }
                    if let Some(t) = &chart.target {
                        check_bounds(t.min, t.max)?;
                        t.of.collect(out)?;
                    }
                    for line in &chart.lines {
                        line.of.collect(out)?;
                    }
                }
            }
        }
        Ok(())
    }
}
