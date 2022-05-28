use actix_web::web;

pub mod users;

pub fn routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api").service(web::scope("/users").route("", web::get().to(users::get_all))),
    );
}
