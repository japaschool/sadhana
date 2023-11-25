use diesel_derive_enum::DbEnum;
use serde::{Deserialize, Serialize};

/// Represents a DB enum for Practice data type field
#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::PracticeDataTypeEnum"]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    Text,
    Duration,
}

#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::ReportTypeEnum"]
pub enum ReportType {
    Graph,
    Grid,
}

#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::TraceTypeEnum"]
pub enum TraceType {
    Bar,
    Line,
    Dot,
}

#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::LineStyleEnum"]
pub enum LineStyle {
    Regular,
    Square,
}

#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[ExistingTypePath = "crate::schema::sql_types::BarLayoutEnum"]
pub enum BarLayout {
    Grouped,
    Overlaid,
    Stacked,
}
