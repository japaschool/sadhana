use dotenv::dotenv;
use std::env::var;

pub fn smtp_username() -> String {
    dotenv().ok();
    var("SMTP_USERNAME").expect("SMTP_USERNAME is not set")
}

pub fn smtp_password() -> String {
    dotenv().ok();
    var("SMTP_PASSWORD").expect("SMTP_PASSWORD is not set")
}

pub fn smtp_host() -> String {
    dotenv().ok();
    var("SMTP_HOST").expect("SMTP_HOST is not set")
}

pub fn smtp_port() -> u16 {
    dotenv().ok();
    var("SMTP_PORT")
        .expect("SMTP_PORT is not set")
        .parse::<u16>()
        .ok()
        .expect("SMTP_PORT should be an integer")
}

pub fn smtp_sender_name() -> String {
    dotenv().ok();
    var("SMTP_SENDER_NAME").expect("SMTP_SENDER_NAME is not set")
}

pub fn smtp_tls_enabled() -> bool {
    dotenv().ok();
    var("SMTP_TLS_ENABLED").expect("SMTP_TLS_ENABLED is not set") == "Y"
}

pub fn server_address() -> String {
    dotenv().ok();
    var("SERVER_ADDRESS").expect("SERVER_ADDRESS is not set")
}

pub fn public_server_address() -> String {
    dotenv().ok();
    var("PUBLIC_SERVER_ADDRESS").expect("PUBLIC_SERVER_ADDRESS is not set")
}

pub fn api_root() -> String {
    dotenv().ok();
    var("API_ROOT").expect("API_ROOT is not set")
}
