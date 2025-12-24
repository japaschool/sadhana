pub mod edit_user_practice;
pub mod edit_yatra_practice;
pub mod new_practice;

#[derive(PartialEq, Clone)]
pub enum Mode {
    UserPractice,
    YatraPractice { yatra_id: String },
}
