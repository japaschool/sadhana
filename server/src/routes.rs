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
                        web::scope("/practice/{practice}")
                            .route("", web::get().to(app::user_practices::get_user_practice))
                            .route(
                                "",
                                web::delete().to(app::user_practices::delete_user_practice),
                            )
                            .route("", web::put().to(app::user_practices::update_user_practice)),
                    )
                    .route("", web::get().to(app::user::api::me))
                    .route("", web::put().to(app::user::api::update_user))
                    .route(
                        "/password",
                        web::put().to(app::user::api::update_user_password),
                    ),
            )
            .service(
                web::scope("/share/{user_id}")
                    .route("/user", web::get().to(app::user::api::user_info))
                    .route(
                        "/practices",
                        web::get().to(app::shared::get_shared_report_practices),
                    )
                    .route("/reports", web::get().to(app::shared::get_shared_reports))
                    .route("", web::get().to(app::shared::get_shared_report_data)),
            )
            .service(
                web::scope("/yatras")
                    .route("", web::post().to(app::yatras::create_yatra))
                    .route("", web::get().to(app::yatras::user_yatras)),
            )
            .service(
                web::scope("/yatra/{yatra_id}")
                    .route("", web::get().to(app::yatras::get_yatra))
                    .route("", web::delete().to(app::yatras::delete_yatra))
                    .route("", web::put().to(app::yatras::rename_yatra))
                    .service(
                        web::scope("/users")
                            .route(
                                "/{user_id}",
                                web::delete().to(app::yatras::delete_yatra_user),
                            )
                            .route(
                                "/{user_id}/is_admin",
                                web::put().to(app::yatras::toggle_is_admin),
                            )
                            .route("", web::get().to(app::yatras::get_yatra_users)),
                    )
                    .service(
                        web::scope("/practices")
                            .route(
                                "/reorder",
                                web::put().to(app::yatras::update_yatra_practice_order_key),
                            )
                            .route("", web::get().to(app::yatras::get_yatra_practices))
                            .route("", web::post().to(app::yatras::create_yatra_practice)),
                    )
                    .service(
                        web::scope("/practice/{practice}")
                            .route("", web::put().to(app::yatras::update_yatra_practice))
                            .route("", web::delete().to(app::yatras::delete_yatra_practice)),
                    )
                    .route("/data", web::get().to(app::yatras::yatra_data))
                    .route(
                        "/user-practices",
                        web::get().to(app::yatras::get_yatra_user_practices),
                    )
                    .route(
                        "/user-practices",
                        web::put().to(app::yatras::update_yatra_user_practices),
                    )
                    .route("/join", web::put().to(app::yatras::join_yatra))
                    .route("/leave", web::put().to(app::yatras::leave_yatra))
                    .route("/is_admin", web::get().to(app::yatras::is_admin)),
            )
            .service(
                web::scope("/support-form").route("", web::post().to(app::support::send_message)),
            )
            .service(
                web::scope("/reports")
                    .route("", web::post().to(app::report::create_report))
                    .route("", web::get().to(app::report::get_reports)),
            )
            .service(
                web::scope("/report/{report_id}")
                    .route("", web::put().to(app::report::update_report))
                    .route("", web::delete().to(app::report::delete_report)),
            )
            .service(
                web::scope("/diary")
                    .route(
                        "/incomplete-days",
                        web::get().to(app::diary::api::get_incomplete_days),
                    )
                    .service(
                        web::scope("/{cob}")
                            .route("/report", web::get().to(app::diary::api::get_report_data))
                            .route(
                                "/entry",
                                web::put().to(app::diary::api::upsert_diary_day_entry),
                            )
                            .route("", web::put().to(app::diary::api::upsert_diary_day))
                            .route("", web::get().to(app::diary::api::get_diary_day)),
                    ),
            ),
    )
    .service(
        Files::new("/", "./dist/")
            .index_file("index.html")
            // Redirect back to index.html for paths not found on disk. See https://github.com/actix/actix-web/issues/2115
            .default_handler(|req: ServiceRequest| {
                let (http_req, _payload) = req.into_parts();
                async move {
                    let response_file = NamedFile::open_async("./dist/index.html").await?;
                    let response = response_file.into_response(&http_req);
                    Ok(ServiceResponse::new(http_req, response))
                }
            }),
    );
}
