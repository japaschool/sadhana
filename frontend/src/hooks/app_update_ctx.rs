use gloo::utils::window;
use wasm_bindgen::{JsCast, prelude::Closure};
use web_sys::MessageEvent;
use yew::{html::ChildrenProps, prelude::*};
use yew_hooks::use_bool_toggle;

#[derive(Clone, PartialEq)]
pub struct AppUpdate {
    pub update_available: bool,
    pub apply_update: Callback<()>,
}

/// Context that listens on UPDATE_READY message from Service Worker.
/// Service Worker in turn is poked to check for updates every time user opens the app.
/// Once SW notices an update, it loads the assets in background and sends UPDATE_READY.
#[function_component(AppUpdateContextProvider)]
pub fn app_update_provider(props: &ChildrenProps) -> Html {
    let update_available = use_bool_toggle(false);

    {
        // Some subtleties. It has to be a context as we receive update message once
        // and need to reset it only on reload. For this reason we do use_effect_with((), ...)
        // so that it wouldn't respond to re-renders.
        let update_available = update_available.clone();
        use_effect_with((), move |_| {
            let listener = Closure::<dyn FnMut(_)>::new(move |e: MessageEvent| {
                if e.data().as_string() == Some("UPDATE_READY".into()) {
                    update_available.set(true);
                }
            });

            window()
                .navigator()
                .service_worker()
                .add_event_listener_with_callback("message", listener.as_ref().unchecked_ref())
                .unwrap();

            move || drop(listener)
        });
    }

    let apply_update = Callback::from(|_| {
        if let Some(controller) = window().navigator().service_worker().controller() {
            controller.post_message(&"SKIP_WAITING".into()).ok();
        }
        window().location().reload().ok();
    });

    let ctx = AppUpdate {
        update_available: *update_available,
        apply_update,
    };

    html! {
        <ContextProvider<AppUpdate> context={ctx}>
            { props.children.clone() }
        </ContextProvider<AppUpdate>>
    }
}
