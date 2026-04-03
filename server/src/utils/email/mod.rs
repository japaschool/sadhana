use crate::vars;
use common::error::AppError;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{SinglePartBuilder, header::ContentType},
    transport::smtp::{authentication::Credentials, client::Tls, extension::ClientId},
};

pub async fn send_email_smtp(to: &str, subject: &str, body: String) -> Result<(), AppError> {
    let user = vars::smtp_username();
    let mut mailer_builder =
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&vars::smtp_host())?
            .port(587)
            .hello_name(ClientId::Domain("sadhana.pro".to_string()));

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
        .singlepart(
            SinglePartBuilder::new()
                .content_type(ContentType::TEXT_HTML)
                .body(body),
        )?;

    mailer_builder.build().send(email).await?;

    Ok(())
}
