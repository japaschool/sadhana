use actix_cors::Cors;
use actix_web::http;

pub fn cors() -> Cors {
    Cors::default()
        .allow_any_origin()
        .send_wildcard()
        .allow_any_method()
        .allowed_headers(vec![
            http::header::AUTHORIZATION,
            http::header::ACCEPT,
            http::header::CONTENT_TYPE,
        ])
        .max_age(3600)
}
