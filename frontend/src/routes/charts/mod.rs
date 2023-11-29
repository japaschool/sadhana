use std::collections::HashSet;

use crate::components::chart::{BarGraphLayout, GraphType, YAxis};
use serde::{Deserialize, Serialize};

mod base;
pub mod create_report;
mod graph_editor;
mod grid_editor;
mod private_charts;
mod shared_charts;

pub use private_charts::Charts;
pub use shared_charts::SharedCharts;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PracticeTrace {
    pub label: Option<String>,
    pub type_: GraphType,
    pub practice: Option<String>,
    pub y_axis: Option<YAxis>,
    pub show_average: bool,
}

impl Default for PracticeTrace {
    fn default() -> Self {
        Self {
            label: Default::default(),
            type_: GraphType::Bar,
            practice: Default::default(),
            y_axis: Default::default(),
            show_average: Default::default(),
        }
    }
}
//TODO: ensure it will work if practice is renamed/deleted

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct ReportForm {
    pub name: String,
    pub definition: ReportDefinition,
}

impl ReportForm {
    pub fn default_graph<S: Into<String>>(name: S) -> Self {
        Self {
            definition: ReportDefinition::Graph(GraphReport::new(BarGraphLayout::Grouped, vec![])),
            name: name.into(),
        }
    }

    pub fn default_grid<S: Into<String>>(name: S) -> Self {
        Self {
            definition: ReportDefinition::Grid(GridReport::new(HashSet::default())),
            name: name.into(),
        }
    }
}

impl From<&Report> for ReportForm {
    fn from(value: &Report) -> Self {
        Self {
            name: value.name.to_owned(),
            definition: value.definition.clone(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct Report {
    pub id: String,
    pub name: String,
    pub definition: ReportDefinition,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ReportDefinition {
    Grid(GridReport),
    Graph(GraphReport),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GraphReport {
    pub bar_layout: BarGraphLayout,
    pub traces: Vec<PracticeTrace>,
}

impl GraphReport {
    pub fn new(bar_layout: BarGraphLayout, traces: Vec<PracticeTrace>) -> Self {
        GraphReport { bar_layout, traces }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct GridReport {
    pub practices: HashSet<String>,
}

impl GridReport {
    pub fn new(practices: HashSet<String>) -> Self {
        Self { practices }
    }
}

pub const SELECTED_REPORT_ID_KEY: &'static str = "SelectedReportId";

#[derive(Debug, Serialize, Deserialize)]
pub struct SelectedReportId {
    pub report_id: String,
}

impl SelectedReportId {
    pub fn new<S: Into<String>>(report_id: S) -> Self {
        Self {
            report_id: report_id.into(),
        }
    }
}
