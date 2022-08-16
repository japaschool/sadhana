use actix_http::{body::BoxBody, Request};
use actix_service::Service;
use actix_web::{dev::ServiceResponse, error::Error, test, web::Data, App};
use serde::{de::DeserializeOwned, Serialize};

use crate::{middleware::state::AppState, routes::routes};

pub async fn get_service(
) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
    test::init_service(
        App::new()
            .app_data(Data::new(AppState::init()))
            .configure(routes),
    )
    .await
}

pub async fn test_get_status(route: &str) -> u16 {
    let app = get_service().await;
    let req = test::TestRequest::get().uri(route);
    let res = test::call_service(&app, req.to_request()).await;

    res.status().as_u16()
}

pub async fn test_get<R>(route: &str) -> (u16, R)
where
    R: DeserializeOwned,
{
    let app = get_service().await;
    let req = test::TestRequest::get().uri(route);
    let res = test::call_service(&app, req.to_request()).await;

    let status = res.status().as_u16();
    let body = test::read_body(res).await;
    let json_body = serde_json::from_slice(&body).unwrap_or_else(|_| {
        panic!(
            "read_response_json failed during deserialization. response: {} status: {}",
            String::from_utf8(body.to_vec())
                .unwrap_or_else(|_| "Could not convert Bytes -> String".to_string()),
            status
        )
    });

    (status, json_body)
}

pub async fn test_post_status<T: Serialize>(route: &str, params: &T) -> u16 {
    let app = get_service().await;

    let req = test::TestRequest::post().set_json(params).uri(route);

    let res = test::call_service(&app, req.to_request()).await;

    res.status().as_u16()
}

pub async fn test_post<T, R>(route: &str, params: &T) -> (u16, R)
where
    T: Serialize,
    R: DeserializeOwned,
{
    let app = get_service().await;

    let req = test::TestRequest::post().set_json(params).uri(route);

    let res = test::call_service(&app, req.to_request()).await;

    let status = res.status().as_u16();
    let body = test::read_body(res).await;
    let json_body = serde_json::from_slice(&body).unwrap_or_else(|_| {
        panic!(
            "read_response_json failed during deserialization. response: {} status: {}",
            String::from_utf8(body.to_vec())
                .unwrap_or_else(|_| "Could not convert Bytes -> String".to_string()),
            status
        )
    });

    (status, json_body)
}
