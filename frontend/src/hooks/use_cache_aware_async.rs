use common::error::AppError;
use gloo::utils::window;
use gloo_events::EventListener;
use gloo_utils::format::JsValueSerdeExt;
use std::{future::Future, ops::Deref};
use wasm_bindgen::JsCast;
use web_sys::MessageEvent;
use yew::prelude::*;
use yew_hooks::{UseAsyncHandle, use_async};

#[derive(serde::Deserialize)]
struct ApiUpdatedMessage {
    #[serde(rename = "type")]
    msg_type: String,
    url: String,
}

pub struct UseCacheAwareAsyncApi<T> {
    pub api: UseAsyncHandle<T, AppError>,
}

impl<T> Deref for UseCacheAwareAsyncApi<T> {
    type Target = UseAsyncHandle<T, AppError>;

    fn deref(&self) -> &Self::Target {
        &self.api
    }
}

/// Wrapper around use_async that is aware of caching done by Service Worker.
/// Service Worker serves certain gets from cache first and then in bg fetches
/// the data from server, and if successful, sends API_UPDATE message.
/// This hook in turn catches that message and reruns the fetcher with cache
/// only flag set.
#[hook]
pub fn use_cache_aware_async<T, F, Fut>(key: String, fetch: F) -> UseCacheAwareAsyncApi<T>
where
    F: Fn(bool) -> Fut + Clone + 'static,
    Fut: Future<Output = Result<T, AppError>>,
    T: Clone + 'static,
{
    let refresh_mode = use_mut_ref(|| false);

    let api = {
        let refresh_mode = refresh_mode.clone();
        let fetch = fetch.clone();
        use_async(async move {
            let from_cache = *refresh_mode.borrow();
            let res = fetch(from_cache).await;
            *refresh_mode.borrow_mut() = false;
            res
        })
    };

    let refresh_cache = {
        let refresh_mode = refresh_mode.clone();
        let api = api.clone();
        Callback::from(move |_| {
            *refresh_mode.borrow_mut() = true;
            api.run();
        })
    };

    use_effect(move || {
        let sw = window().navigator().service_worker();

        let listener = EventListener::new(sw.as_ref(), "message", move |e| {
            let e = e
                .dyn_ref::<MessageEvent>()
                .expect("event should be a MessageEvent");

            if let Ok(msg) = e.data().into_serde::<ApiUpdatedMessage>() {
                log::debug!("Processing API_UPDATED for {} and key {}", msg.url, key);
                if msg.msg_type == "API_UPDATED" && msg.url.contains(&key) {
                    log::debug!(
                        "Calling refresh of async task for {} and key {}",
                        msg.url,
                        key
                    );
                    refresh_cache.emit(());
                }
            }
        });

        move || drop(listener)
    });

    UseCacheAwareAsyncApi { api }
}
