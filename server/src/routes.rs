use actix_files::{Files, NamedFile};
use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    web,
};

use crate::app;

pub fn routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .service(
                web::scope("/users")
                    .route("/login", web::post().to(app::user::api::signin))
                    .route("", web::post().to(app::user::api::signup)),
            )
            .service(web::scope("/user").route("", web::get().to(app::user::api::me))),
    ).service(
            Files::new("/", "./dist/")
                .index_file("index.html")
                // Redirect back to index.html for paths not found on disk. See https://github.com/actix/actix-web/issues/2115
                .default_handler(|req: ServiceRequest| {
                    let (http_req, _payload) = req.into_parts();
                    async {
                        let response =
                            NamedFile::open("./dist/index.html")?.into_response(&http_req);
                        Ok(ServiceResponse::new(http_req, response))
                    }
                }),
        );
}
