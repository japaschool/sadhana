use gloo::utils::window;
use gloo_events::EventListener;
use wasm_bindgen::JsCast;
use web_sys::MessageEvent;
use yew::{html::ChildrenProps, prelude::*};
use yew_hooks::use_bool_toggle;

#[derive(Clone, PartialEq)]
pub struct NetworkStatusContext {
    pub online: bool,
}

/// Context that listens on UPDATE_READY message from Service Worker.
/// Service Worker in turn is poked to check for updates every time user opens the app.
/// Once SW notices an update, it loads the assets in background and sends UPDATE_READY.
#[function_component(NetworkStatusProvider)]
pub fn network_status_provider(props: &ChildrenProps) -> Html {
    let online = use_bool_toggle(true);

    // Listen for SW messages
    {
        let online = online.clone();

        // Using effect with deps to avoid running on ever render
        use_effect_with((), move |_| {
            let sw = window().navigator().service_worker();

            let listener = EventListener::new(sw.as_ref(), "message", move |e| {
                let e = e
                    .dyn_ref::<MessageEvent>()
                    .expect("event should be a MessageEvent");

                if let Some(msg) = e.data().as_string() {
                    if msg == "ONLINE" {
                        online.set(true);
                    } else if msg == "OFFLINE" {
                        online.set(false);
                    }
                }
            });

            || drop(listener)
        });
    }

    let ctx = NetworkStatusContext { online: *online };

    html! {
        <ContextProvider<NetworkStatusContext> context={ctx}>
            { props.children.clone() }
        </ContextProvider<NetworkStatusContext>>
    }
}
