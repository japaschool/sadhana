use std::env::var;

pub fn smtp_username() -> String {
    var("SMTP_USERNAME").expect("SMTP_USERNAME is not set")
}

pub fn smtp_password() -> String {
    var("SMTP_PASSWORD").expect("SMTP_PASSWORD is not set")
}

pub fn smtp_host() -> String {
    var("SMTP_HOST").expect("SMTP_HOST is not set")
}

pub fn smtp_port() -> u16 {
    var("SMTP_PORT")
        .expect("SMTP_PORT is not set")
        .parse::<u16>()
        .expect("SMTP_PORT should be an integer")
}

pub fn smtp_sender_name() -> String {
    var("SMTP_SENDER_NAME").expect("SMTP_SENDER_NAME is not set")
}

pub fn smtp_tls_enabled() -> bool {
    var("SMTP_TLS_ENABLED").expect("SMTP_TLS_ENABLED is not set") == "Y"
}

pub fn server_address() -> String {
    var("SERVER_ADDRESS").expect("SERVER_ADDRESS is not set")
}

pub fn support_email_address() -> String {
    var("SUPPORT_EMAIL").expect("SUPPORT_EMAIL is not set")
}

pub fn git_sha() -> String {
    var("GIT_SHA").expect("GIT_SHA is not set")
}

pub fn release_channel() -> String {
    var("RELEASE_CHANNEL").unwrap_or_else(|_| "stable".to_owned())
}

pub fn run_db_migrations_on_startup() -> bool {
    var("RUN_DB_MIGRATIONS").is_ok_and(|v| v == "1")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_db_migrations_defaults_to_false() {
        unsafe { std::env::remove_var("RUN_DB_MIGRATIONS") };
        assert!(!run_db_migrations_on_startup());
    }

    #[test]
    fn run_db_migrations_reads_flag() {
        unsafe { std::env::set_var("RUN_DB_MIGRATIONS", "1") };
        assert!(run_db_migrations_on_startup());

        unsafe { std::env::set_var("RUN_DB_MIGRATIONS", "0") };
        assert!(!run_db_migrations_on_startup());
    }
}
