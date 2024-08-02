use common::error::*;
use gloo::storage::{LocalStorage, Storage};
use lazy_static::lazy_static;
use parking_lot::RwLock;
use serde::{de::DeserializeOwned, Serialize};

const TOKEN_KEY: &str = "yew.token";

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
pub async fn request<B, T>(method: reqwest::Method, url: String, body: &B) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    let url = format!("{}{}", API_ROOT.as_str(), url);

    log::debug!("Sending {} request to {}", method, url);

    let with_body = method == reqwest::Method::POST || method == reqwest::Method::PUT;
    let mut builder = reqwest::Client::new()
        .request(method, url)
        .header("Content-Type", "application/json");

    if let Some(token) = get_token() {
        builder = builder.bearer_auth(token);
    }

    if with_body {
        builder = builder.json(&body);
    }

    let response = builder.send().await;

    if let Ok(data) = response {
        if data.status().is_success() {
            log::debug!("Got Ok response with data {:?}", data);

            let data: Result<T, _> = data.json::<T>().await;
            if let Ok(data) = data {
                log::debug!("Response: {:?}", data);

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

/// Delete request
pub async fn request_delete<T>(url: String) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
{
    request(reqwest::Method::DELETE, url, &()).await
}

/// Get request
pub async fn request_get<T>(url: String) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
{
    request(reqwest::Method::GET, url, &()).await
}

/// Get request
pub async fn request_post<T, B>(url: String, body: &B) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    request(reqwest::Method::POST, url, body).await
}

/// Put request with a body
pub async fn request_put<B, T>(url: String, body: &B) -> Result<T, AppError>
where
    T: DeserializeOwned + 'static + std::fmt::Debug,
    B: Serialize + std::fmt::Debug,
{
    request(reqwest::Method::PUT, url, body).await
}
