use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Group {
    pub id: Option<Uuid>,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize)]
pub struct GroupsResponse {
    pub groups: Vec<Group>,
}

#[derive(Debug, Serialize)]
pub struct CreatedGroup {
    pub id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct NameForm {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct LayoutPractice {
    pub id: Uuid,
    pub group_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct Layout {
    pub groups: Vec<Option<Uuid>>,
    pub practices: Vec<LayoutPractice>,
}
