use gloo::utils::window;
use wasm_bindgen::{JsCast, prelude::Closure};
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
            let listener = Closure::<dyn FnMut(MessageEvent)>::new(move |e: MessageEvent| {
                if let Some(msg) = e.data().as_string() {
                    // msg could be something else
                    if msg == "ONLINE" {
                        online.set(true);
                    } else if msg == "OFFLINE" {
                        online.set(false);
                    }
                }
            });

            let sw = window().navigator().service_worker();
            sw.add_event_listener_with_callback("message", listener.as_ref().unchecked_ref())
                .unwrap();

            move || {
                sw.remove_event_listener_with_callback(
                    "message",
                    listener.as_ref().unchecked_ref(),
                )
                .ok();
                drop(listener);
            }
        });
    }

    let ctx = NetworkStatusContext { online: *online };

    html! {
        <ContextProvider<NetworkStatusContext> context={ctx}>
            { props.children.clone() }
        </ContextProvider<NetworkStatusContext>>
    }
}
