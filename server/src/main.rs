use actix_web::{middleware::Logger, web::Data, App, HttpServer};
use diesel_migrations::*;
use dotenv::dotenv;
#[cfg(not(target_env = "msvc"))]
use jemallocator::Jemalloc;

#[macro_use]
extern crate log;

#[macro_use]
extern crate dotenv_codegen;

mod app;
mod constants;
mod db_types;
mod hasher;
mod middleware;
mod routes;
mod schema;
mod utils;
mod vars;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

    HttpServer::new(move || {
        let app_state = middleware::state::AppState::init();

        app_state
            .get_conn()
            .unwrap()
            .run_pending_migrations(MIGRATIONS)
            .unwrap();

        App::new()
            .wrap(Logger::default())
            .app_data(Data::new(app_state))
            .wrap(middleware::cors::cors())
            .wrap(middleware::auth::Authentication)
            .configure(routes::routes)
    })
    .bind(vars::server_address())?
    .run()
    .await
}
