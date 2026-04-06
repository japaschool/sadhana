use gloo::utils::window;
use js_sys::Reflect;
use wasm_bindgen::{JsCast, JsValue};
use web_sys::ServiceWorkerContainer;

/// Get the ServiceWorkerContainer if the Service Worker API is available.
/// Returns None if the browser doesn't support Service Workers or if the API is unavailable.
pub fn get_service_worker() -> Option<ServiceWorkerContainer> {
    let navigator = window().navigator();

    Reflect::get(&navigator, &JsValue::from_str("serviceWorker"))
        .ok()
        .filter(|v| !v.is_undefined())
        .and_then(|v| v.dyn_into().ok())
}
