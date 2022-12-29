use diesel_derive_enum::DbEnum;
use serde::{Deserialize, Serialize};

/// Represents a DB enum for Practice data type field
#[derive(DbEnum, PartialEq, Debug, Serialize, Clone, Deserialize)]
#[DieselTypePath = "crate::schema::sql_types::PracticeDataTypeEnum"]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
    Text,
}
