use crate::model::PracticeDataType;

mod daily_score_conf;
pub mod edit_user_practice;
pub mod edit_yatra_practice;
pub mod new_practice;

#[derive(PartialEq, Clone)]
pub enum Mode {
    UserPractice,
    YatraPractice { yatra_id: String },
}

const COLOUR_ZONE_DATA_TYPES: [PracticeDataType; 3] = [
    PracticeDataType::Time,
    PracticeDataType::Duration,
    PracticeDataType::Int,
];
