use crate::vars;
use common::error::AppError;
use lettre::{
    transport::smtp::{authentication::Credentials, client::Tls},
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};

pub async fn send_email_smtp(to: &str, subject: &str, body: String) -> Result<(), AppError> {
    let user = vars::smtp_username();
    let mut mailer_builder = AsyncSmtpTransport::<Tokio1Executor>::relay(&dbg!(vars::smtp_host()))?
        .port(vars::smtp_port());

    if !vars::smtp_tls_enabled() {
        mailer_builder = mailer_builder.tls(Tls::None);
    }

    if !user.is_empty() {
        mailer_builder = mailer_builder.credentials(Credentials::new(user, vars::smtp_password()));
    }

    let email = Message::builder()
        .from(vars::smtp_sender_name().parse()?)
        .to(to.parse()?)
        .subject(subject)
        .body(body)?;

    mailer_builder.build().send(email).await?;

    Ok(())
}
