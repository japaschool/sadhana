use actix_web::{web, HttpRequest, HttpResponse};
use common::error::AppError;
use serde::Deserialize;

use crate::{middleware::auth, utils::email::send_email_smtp, vars};

/// Send a message to application support team
pub async fn send_message(
    req: HttpRequest,
    form: web::Json<SupportMessageForm>,
) -> Result<HttpResponse, AppError> {
    let user = auth::get_current_user(&req)?;
    let body = format!("{}\n\nFrom: {}\nId: {}", form.message, user.name, user.id);

    send_email_smtp(&vars::support_email_address(), &form.subject, body).await?;

    Ok(HttpResponse::Ok().json(()))
}

#[derive(Debug, Deserialize)]
pub struct SupportMessageForm {
    subject: String,
    message: String,
}
