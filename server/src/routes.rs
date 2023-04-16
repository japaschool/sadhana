use actix_files::{Files, NamedFile};
use actix_web::{
    dev::{ServiceRequest, ServiceResponse},
    web,
};

use crate::app::{self};

pub fn routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .service(
                web::scope("/users")
                    .service(
                        web::scope("/confirmation")
                            .route("/{id}", web::get().to(app::user::api::confirmation_details))
                            .route("", web::post().to(app::user::api::send_confirmation_link)),
                    )
                    .route("/login", web::post().to(app::user::api::signin))
                    .route("", web::post().to(app::user::api::signup)),
            )
            .service(
                web::scope("/password-reset")
                    .route("", web::put().to(app::user::api::reset_password)),
            )
            .service(
                web::scope("/user")
                    .service(
                        web::scope("/practices")
                            .route("", web::post().to(app::user_practices::add_new))
                            .route(
                                "/reorder",
                                web::put().to(app::user_practices::update_user_practice_order_key),
                            )
                            .route("", web::get().to(app::user_practices::get_user_practices)),
                    )
                    .service(
                        web::scope("/practice")
                            .route(
                                "{practice}",
                                web::delete().to(app::user_practices::delete_user_practice),
                            )
                            .route(
                                "{practice}",
                                web::put().to(app::user_practices::update_user_practice),
                            ),
                    )
                    .route("", web::get().to(app::user::api::me))
                    .route("", web::put().to(app::user::api::update_user)),
            )
            .service(
                web::scope("/diary")
                    .route("/report", web::get().to(app::diary::api::get_report_data))
                    .route("", web::post().to(app::diary::api::upsert_diary_day))
                    .route("", web::get().to(app::diary::api::get_diary_day)),
            ),
    )
    .service(
        Files::new("/", "./dist/")
            .index_file("index.html")
            // Redirect back to index.html for paths not found on disk. See https://github.com/actix/actix-web/issues/2115
            .default_handler(|req: ServiceRequest| {
                let (http_req, _payload) = req.into_parts();
                async {
                    let response = NamedFile::open("./dist/index.html")?.into_response(&http_req);
                    Ok(ServiceResponse::new(http_req, response))
                }
            }),
    );
}
