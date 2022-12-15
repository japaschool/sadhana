use actix_web::{middleware::Logger, web::Data, App, HttpServer};
use dotenv::dotenv;

#[macro_use]
extern crate log;

mod app;
mod constants;
mod db_types;
mod hasher;
mod middleware;
mod routes;
mod schema;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .app_data(Data::new(middleware::state::AppState::init()))
            .wrap(middleware::cors::cors())
            .wrap(middleware::auth::Authentication)
            .configure(routes::routes)
    })
    .bind(constants::BIND)?
    .run()
    .await
}
