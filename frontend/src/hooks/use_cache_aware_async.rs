use common::error::AppError;
use gloo::utils::window;
use gloo_events::EventListener;
use gloo_utils::format::JsValueSerdeExt;
use serde::Deserialize;
use std::ops::Deref;
use uuid::Uuid;
use wasm_bindgen::JsCast;
use web_sys::MessageEvent;
use yew::prelude::*;
use yew_hooks::{UseAsyncHandle, use_async};

use crate::services::requests::{GetApiRequest, RequestOptions};
#[derive(Deserialize)]
struct ApiUpdatedMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(rename = "cacheKey")]
    cache_key: String,
}

#[derive(PartialEq)]
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
pub fn use_cache_aware_async<T>(req: GetApiRequest<T>) -> UseCacheAwareAsyncApi<T>
where
    T: Clone + 'static,
{
    let refresh_mode = use_mut_ref(|| false);
    let hook_id = use_state(|| Uuid::new_v4().to_string());

    let api = {
        let refresh_mode = refresh_mode.clone();
        let hook_id = hook_id.clone();
        use_async(async move {
            let opts = RequestOptions {
                use_cache: *refresh_mode.borrow(),
                cache_key: Some(hook_id.to_string()),
            };

            let res = (req.send)(opts).await;
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

    {
        let hook_id = hook_id.clone();
        use_effect(move || {
            let sw = window().navigator().service_worker();

            let listener = EventListener::new(sw.as_ref(), "message", move |e| {
                let e = e
                    .dyn_ref::<MessageEvent>()
                    .expect("event should be a MessageEvent");

                if let Ok(msg) = e.data().into_serde::<ApiUpdatedMessage>() {
                    if msg.msg_type == "API_UPDATED" && msg.cache_key.contains(&*hook_id) {
                        log::debug!("Calling refresh of async task for {}", msg.cache_key);
                        refresh_cache.emit(());
                    }
                }
            });

            move || drop(listener)
        });
    }

    UseCacheAwareAsyncApi { api }
}
