use gloo::utils::window;
use gloo_events::EventListener;
use wasm_bindgen::JsCast;
use web_sys::MessageEvent;
use yew::{html::ChildrenProps, prelude::*};
use yew_hooks::use_bool_toggle;

#[derive(Clone, PartialEq)]
pub struct AppUpdate {
    pub update_ready: bool,
    pub apply_update: Callback<()>,
}

/// Context that listens on UPDATE_READY message from Service Worker.
/// Service Worker in turn is poked to check for updates every time user opens the app.
/// Once SW notices an update, it loads the assets in background and sends UPDATE_READY.
#[function_component(AppUpdateContextProvider)]
pub fn app_update_provider(props: &ChildrenProps) -> Html {
    let update_ready = use_bool_toggle(false);

    {
        // Some subtleties. It has to be a context as we receive update message once
        // and need to reset it only on reload. For this reason we do use_effect_with((), ...)
        // so that it wouldn't respond to re-renders.
        let update_ready = update_ready.clone();
        use_effect_with((), move |_| {
            let sw = window().navigator().service_worker();

            let listener = EventListener::new(&sw, "message", move |event| {
                let event = event.dyn_ref::<MessageEvent>().unwrap();

                if let Some(msg) = event.data().as_string() {
                    if msg == "UPDATE_READY" {
                        update_ready.set(true);
                    }
                }
            });

            move || drop(listener)
        });
    }

    let apply_update = Callback::from(|_| {
        if let Some(controller) = window().navigator().service_worker().controller() {
            controller
                .post_message(&r#"{ "type": "SKIP_WAITING" }"#.into())
                .ok();
        }
        window().location().reload().ok();
    });

    let ctx = AppUpdate {
        update_ready: *update_ready,
        apply_update,
    };

    html! {
        <ContextProvider<AppUpdate> context={ctx}>
            { props.children.clone() }
        </ContextProvider<AppUpdate>>
    }
}
