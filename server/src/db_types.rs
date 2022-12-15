use diesel_derive_enum::DbEnum;
use serde::Serialize;

/// Represents a DB enum for Practice data type field
#[derive(DbEnum, PartialEq, Debug, Serialize)]
#[DieselTypePath = "crate::schema::sql_types::PracticeDataTypeEnum"]
pub enum PracticeDataType {
    Int,
    Bool,
    Time,
}
