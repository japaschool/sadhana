use std::fmt::{Display, Formatter, Result};

use crate::{
    model::{PracticeDataType, Value},
    tr,
};
use serde::{Deserialize, Serialize};
use strum::{Display, EnumIter, EnumString};

#[derive(
    Debug, Serialize, Deserialize, Clone, PartialEq, Default, Display, EnumIter, EnumString,
)]
pub enum Aggregation {
    Sum,
    Avg,
    Min,
    Max,
    #[default]
    Count,
}

impl Aggregation {
    pub fn to_localised_string(&self) -> String {
        match self {
            Aggregation::Sum => tr!(yatra_stats_agg_sum),
            Aggregation::Avg => tr!(yatra_stats_agg_avg),
            Aggregation::Min => tr!(yatra_stats_agg_min),
            Aggregation::Max => tr!(yatra_stats_agg_max),
            Aggregation::Count => tr!(yatra_stats_agg_cnt),
        }
    }
}

#[derive(
    Debug, Serialize, Deserialize, Clone, PartialEq, Default, Display, EnumIter, EnumString,
)]
pub enum TimeRange {
    Last7Days,
    Last30Days,
    Last90Days,
    Last365Days,
    ThisWeek,
    #[default]
    ThisMonth,
    ThisQuarter,
    ThisYear,
}

impl TimeRange {
    pub fn to_localised_string(&self) -> String {
        match self {
            TimeRange::Last7Days => tr!(yatra_stats_time_range_last_7_days),
            TimeRange::Last30Days => tr!(yatra_stats_time_range_last_30_days),
            TimeRange::Last90Days => tr!(yatra_stats_time_range_last_90_days),
            TimeRange::Last365Days => tr!(yatra_stats_time_range_last_365_days),
            TimeRange::ThisWeek => tr!(yatra_stats_time_range_this_week),
            TimeRange::ThisMonth => tr!(yatra_stats_time_range_this_month),
            TimeRange::ThisQuarter => tr!(yatra_stats_time_range_this_quarter),
            TimeRange::ThisYear => tr!(yatra_stats_time_range_this_year),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct YatraStatistic {
    pub label: String,
    pub practice_id: String,
    pub aggregation: Aggregation,
    pub time_range: TimeRange,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct YatraStatistics {
    pub visible_to_all: bool,
    pub statistics: Vec<YatraStatistic>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
pub struct Yatra {
    pub id: String,
    pub name: String,
    pub statistics: Option<YatraStatistics>,
    pub show_stability_metrics: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Yatras {
    pub yatras: Vec<Yatra>,
}

#[derive(
    Clone, PartialEq, Display, Debug, Default, EnumString, EnumIter, Deserialize, Serialize,
)]
pub enum ZoneColour {
    #[default]
    Neutral,
    MutedRed,
    Red,
    Yellow,
    Green,
    DarkGreen,
}

impl ZoneColour {
    pub fn to_localised_string(&self) -> String {
        match self {
            ZoneColour::Neutral => tr!(colour_neutral),
            ZoneColour::MutedRed => todo!(),
            ZoneColour::Red => tr!(colour_red),
            ZoneColour::Yellow => tr!(colour_yellow),
            ZoneColour::Green => tr!(colour_green),
            ZoneColour::DarkGreen => todo!(),
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Default)]
pub struct ColourZonesConfig {
    pub better_direction: BetterDirection,
    pub bounds: Vec<Bound>,
    pub no_value_colour: ZoneColour,
    pub best_colour: Option<ZoneColour>,
}

impl ColourZonesConfig {
    pub fn find_zone(&self, value: Option<&Value>) -> ZoneColour {
        if value.is_none() {
            return self.no_value_colour.clone();
        }

        for bound in &self.bounds {
            let Some(to) = &bound.to else {
                continue; // ignore None
            };
            if value.unwrap() <= to {
                return bound.colour.clone();
            }
        }
        // fallback
        match self.better_direction {
            BetterDirection::Higher => self.best_colour.clone().unwrap_or(ZoneColour::Green),
            BetterDirection::Lower => self.best_colour.clone().unwrap_or(ZoneColour::Red),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Display, EnumString, Deserialize, Serialize, Default)]
pub enum BetterDirection {
    #[default]
    Higher,
    Lower,
}

impl BetterDirection {
    pub fn to_localised_string(&self) -> String {
        match self {
            BetterDirection::Higher => tr!(colour_zones_better_when_higher),
            BetterDirection::Lower => tr!(colour_zones_better_when_lower),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize)]
pub struct Bound {
    pub to: Option<Value>,
    pub colour: ZoneColour,
}

impl Bound {
    pub fn new(to: Option<Value>, colour: ZoneColour) -> Self {
        Self { to, colour }
    }

    pub fn default_red() -> Self {
        Self {
            colour: ZoneColour::Red,
            ..Default::default()
        }
    }
    pub fn default_yellow() -> Self {
        Self {
            colour: ZoneColour::Yellow,
            ..Default::default()
        }
    }
}

// ----------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct BonusRule {
    pub threshold: Value,
    pub points: u8,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, Default)]
pub struct DailyScoreConfig {
    pub better_direction: BetterDirection,
    pub mandatory_threshold: Option<Value>,
    pub bonus_rules: Vec<BonusRule>,
}

// ----------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct NewYatraPractice {
    pub yatra_id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Default)]
pub struct YatraPractice {
    pub id: String,
    pub practice: String,
    pub data_type: PracticeDataType,
    pub colour_zones: Option<ColourZonesConfig>,
    pub daily_score: Option<DailyScoreConfig>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
pub struct YatraUser {
    pub user_id: String,
    pub user_name: String,
    pub is_admin: bool,
}

// ----------------------------------------------------------------------------

#[derive(Debug, Deserialize, Clone)]
pub struct YatraPractices {
    pub practices: Vec<YatraPractice>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraUsers {
    pub users: Vec<YatraUser>,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatraPracticesOrderKey {
    pub practices: Vec<String>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub enum TrendArrow {
    Up,
    Down,
    Flat,
}

impl Display for TrendArrow {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let s = match self {
            TrendArrow::Up => "↗",
            TrendArrow::Down => "↘",
            TrendArrow::Flat => "→",
        };
        write!(f, "{}", s)
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct UserYatraData {
    pub user_id: String,
    pub user_name: String,
    pub row: Vec<Option<Value>>,
    pub trend_arrow: Option<TrendArrow>,
    pub stability_heatmap: Vec<i16>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraStatisticRow {
    pub label: String,
    pub value: Option<Value>,
}

#[derive(Debug, Deserialize, Default, Clone)]
pub struct YatraData {
    pub practices: Vec<YatraPractice>,
    pub data: Vec<UserYatraData>,
    pub statistics: Vec<YatraStatisticRow>,
    pub stability_heatmap_days: Vec<i32>,
}

#[derive(Debug, Serialize)]
pub struct CreateYatra {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatra {
    pub yatra: Yatra,
}

#[derive(Debug, Deserialize, Clone)]
pub struct YatraResponse {
    pub yatra: Yatra,
}
#[derive(Debug, Deserialize, Clone)]
pub struct IsYatraAdminResponse {
    pub is_admin: bool,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GetYatraPractice {
    pub practice: YatraPractice,
}

#[derive(Debug, Serialize)]
pub struct CreateYatraPractice {
    pub practice: NewYatraPractice,
}

#[derive(Debug, Serialize)]
pub struct UpdateYatraPractice<'a> {
    pub practice: &'a YatraPractice,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
pub struct YatraUserPractice {
    pub yatra_practice: YatraPractice,
    pub user_practice: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct YatraUserPractices {
    pub practices: Vec<YatraUserPractice>,
}
