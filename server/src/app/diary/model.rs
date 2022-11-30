use actix_web::web::Json;
use chrono::{Date, DateTime, Utc};
use uuid::Uuid;

pub struct JournalRecord {
    pub cob_date: Date<Utc>,
    pub user_id: Uuid,
    pub metric: String,
    // pub value: Option<Json<>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
