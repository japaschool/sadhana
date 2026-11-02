use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StartedFrom {
    Signup,
    AddPractice,
}

impl StartedFrom {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Signup => "signup",
            Self::AddPractice => "add_practice",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Finished,
    Left,
}

impl Outcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Finished => "finished",
            Self::Left => "left",
        }
    }
}
