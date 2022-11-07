use actix_web::{web, HttpResponse};

use crate::{error::AppError, middleware::state::AppState};

use super::request;

pub fn upsert(
    state: web::Data<AppState>,
    form: web::Json<request::Upsert>,
) -> Result<HttpResponse, AppError> {
    todo!()
}

// TODO: from/to dates query parameters
pub fn show(state: web::Data<AppState>) -> Result<HttpResponse, AppError> {
    todo!()
}
