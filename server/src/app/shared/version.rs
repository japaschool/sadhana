use serde::Serialize;

use crate::vars::{git_sha, release_channel};

#[derive(Serialize)]
pub struct VersionResponse {
    pub git_sha: String,
    pub release_channel: String,
}

impl VersionResponse {
    pub fn current() -> Self {
        Self {
            git_sha: git_sha().chars().take(8).collect(),
            release_channel: release_channel(),
        }
    }
}
