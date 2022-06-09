use actix_cors::Cors;
use actix_web::{
    http,
    middleware::Logger,
    web::{Data, JsonConfig},
    App, HttpServer,
};
use dotenv::dotenv;

mod routes;
#[cfg(test)]
mod test_helpers;
mod validation;

#[actix_web::main]
pub async fn main() -> std::io::Result<()> {
    dotenv().ok();

    env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));

    let pool = db::new_pool();

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .send_wildcard()
            // .allowed_methods(vec!["GET"])
            // .allowed_origin(&env::var("CLIENT_HOST").unwrap())
            .allow_any_method()
            .allowed_headers(vec![
                http::header::AUTHORIZATION,
                http::header::ACCEPT,
                http::header::CONTENT_TYPE,
            ])
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .wrap(Logger::new("%a %{User-Agent}i"))
            .app_data(Data::new(pool.clone()))
            // limit the maximum amount of data that server will accept
            .app_data(JsonConfig::default().limit(4096))
            .configure(routes::routes)
    })
    .bind("0.0.0.0:8080")?
    .run()
    .await
}
