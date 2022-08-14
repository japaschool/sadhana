use actix_web::{middleware::Logger, App, HttpServer};
use dotenv::dotenv;

#[macro_use]
extern crate diesel;

#[macro_use]
extern crate log;

mod app;
mod constants;
mod error;
mod hasher;
mod middleware;
mod routes;
mod schema;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let state = {
        let pool = utils::db::establish_connection();
        middleware::state::AppState { pool }
    };

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .app_data(actix_web::web::Data::new(state.clone()))
            .wrap(middleware::cors::cors())
            .wrap(middleware::auth::Authentication)
            .configure(routes::routes)
    })
    .bind(constants::BIND)?
    .run()
    .await
}
