use std::sync::Arc;

use common::error::*;
use futures::{FutureExt, future::LocalBoxFuture};
use gloo::storage::{LocalStorage, Storage};
use lazy_static::lazy_static;
use parking_lot::RwLock;
use reqwest::{
    Method,
    header::{HeaderMap, HeaderValue},
};
use serde::{Serialize, de::DeserializeOwned};

const TOKEN_KEY: &str = "yew.token";

pub struct RequestOptions {
    pub use_cache: bool,
    pub cache_key: Option<String>,
}

impl RequestOptions {
    pub fn new(use_cache: bool) -> Self {
        Self {
            use_cache,
            cache_key: None,
        }
    }
}

pub type GetApiFuture<T> = LocalBoxFuture<'static, Result<T, AppError>>;

pub struct GetApiRequest<T> {
    pub url: String,
    pub send: Box<dyn Fn(RequestOptions) -> GetApiFuture<T>>,
}

impl<T> GetApiRequest<T> {
    pub fn pure<F>(f: F) -> GetApiRequest<T>
    where
        F: Fn() -> T + 'static,
        T: 'static,
    {
        GetApiRequest {
            url: String::new(),
            send: Box::new(move |_opts| {
                let value = f();
                async move { Ok(value) }.boxed_local()
            }),
        }
    }

    pub fn map<U, F>(self, f: F) -> GetApiRequest<U>
    where
        F: Fn(T) -> U + 'static,
        T: 'static,
        U: 'static,
    {
        let f = Arc::new(f);

        GetApiRequest {
            url: self.url,
            send: Box::new(move |opts| {
                let fut = (self.send)(opts);
                let f = f.clone();

                async move {
                    let res = fut.await?;
                    Ok(f(res))
                }
                .boxed_local()
            }),
        }
    }
}

lazy_static! {
    /// Jwt token read from local storage.
    static ref TOKEN: RwLock<Option<String>> = {
        if let Ok(token) = LocalStorage::get(TOKEN_KEY) {
            RwLock::new(Some(token))
        } else {
            RwLock::new(None)
        }
    };

    pub static ref SERVER_ADDRESS: String = {
        web_sys::window().expect("API_ROOT is not set").origin()
    };

    static ref API_ROOT: String = {
        format!("{}/api", *SERVER_ADDRESS)
    };
}

/// Set jwt token to local storage.
pub fn set_token(token: Option<String>) {
    if let Some(t) = token.clone() {
        LocalStorage::set(TOKEN_KEY, t).expect("failed to set");
    } else {
        LocalStorage::delete(TOKEN_KEY);
    }
    let mut token_lock = TOKEN.write();
    *token_lock = token;
}

/// Get jwt token from lazy static.
pub fn get_token() -> Option<String> {
    let token_lock = TOKEN.read();
    token_lock.clone()
}

/// build all kinds of http request: post/get/delete etc.
pub async fn request<B, T>(
    method: Method,
    url: &str,
    body: &B,
    extra_headers: Option<HeaderMap>,
) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    let url = format!("{}{}", *SERVER_ADDRESS, url);

    // log::debug!("Sending {} request to {}", method, url);

    let with_body = method == Method::POST || method == Method::PUT;
    let mut builder = reqwest::Client::new()
        .request(method, url)
        .header("Content-Type", "application/json");

    if let Some(headers) = extra_headers {
        builder = builder.headers(headers);
    }

    if let Some(token) = get_token() {
        builder = builder.bearer_auth(token);
    }

    if with_body {
        builder = builder.json(&body);
    }

    let response = builder.send().await;

    if let Ok(data) = response {
        if data.status().is_success() {
            // log::debug!("Got Ok response with data {:?}", data);

            let data: Result<T, _> = data.json::<T>().await;
            if let Ok(data) = data {
                // log::debug!("Response: {:?}", data);

                Ok(data)
            } else {
                log::debug!("Couldn't deserialise response: {:?}", data);
                Err(AppError::DeserializeError)
            }
        } else {
            match data.status().as_u16() {
                401 => Err(AppError::Unauthorized(
                    data.json::<String>().await.unwrap_or_default(),
                )),
                403 => Err(AppError::Forbidden(
                    data.json::<String>().await.unwrap_or_default(),
                )),
                404 => Err(AppError::NotFound),
                500 => Err(AppError::InternalServerError),
                422 => {
                    let data = data.json::<Vec<String>>().await;
                    if let Ok(data) = data {
                        Err(AppError::UnprocessableEntity(data))
                    } else {
                        Err(AppError::DeserializeError)
                    }
                }
                _ => Err(AppError::RequestError),
            }
        }
    } else {
        Err(AppError::RequestError)
    }
}

pub async fn request_api<B, T>(
    method: Method,
    url: &str,
    body: &B,
    extra_headers: Option<HeaderMap>,
) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    request(method, format!("/api{url}").as_str(), body, extra_headers).await
}

/// Delete api request
pub async fn request_api_delete<T>(url: &str) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
{
    request_api(Method::DELETE, url, &(), None).await
}

/// Get api request bypassing caching
pub async fn request_api_get_no_cache<T>(url: &str) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
{
    request_api(Method::GET, url, &(), None).await
}

/// Get api request that can handle caching by SW
pub fn request_api_get<T, S>(url: S) -> GetApiRequest<T>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    S: Into<String>,
{
    let url = url.into();
    GetApiRequest {
        url: url.clone(),
        send: Box::new(
            move |RequestOptions {
                      use_cache,
                      cache_key,
                  }| {
                let url = url.clone();
                Box::pin(async move {
                    let mut headers = HeaderMap::new();
                    if use_cache {
                        headers.insert("X-Cache-Only", HeaderValue::from_static("1"));
                    }
                    if let Some(key) = cache_key {
                        headers.insert("X-Cache-Key", HeaderValue::from_str(&key).unwrap());
                    }
                    request_api(
                        Method::GET,
                        &url,
                        &(),
                        Some(headers).filter(|h| !h.is_empty()),
                    )
                    .await
                })
            },
        ),
    }
}

/// Post api request
pub async fn request_api_post<T, B>(url: &str, body: &B) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    request_api(Method::POST, url, body, None).await
}

/// Put api request with a body
pub async fn request_api_put<B, T>(url: &str, body: &B) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    request_api(Method::PUT, url, body, None).await
}
