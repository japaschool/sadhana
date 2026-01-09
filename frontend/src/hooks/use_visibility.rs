use gloo::utils::window;
use gloo_events::EventListener;
use web_sys::VisibilityState;
use yew::prelude::*;
use yew_hooks::use_bool_toggle;

#[derive(Debug, Clone, PartialEq)]
pub struct VisibilityStatus {
    pub visible: bool,
}

/// Hook for reacting to app being minimised or opened
#[hook]
pub fn use_visibility() -> VisibilityStatus {
    let visible = use_bool_toggle(true);

    {
        let visible = visible.clone();
        use_effect_with((), move |_| {
            let document = window().document().expect("no document");

            let listener = EventListener::new(&window(), "visibilitychange", move |_| {
                log::debug!("Received a vsibility change event from the browser");

                match document.visibility_state() {
                    VisibilityState::Visible => visible.set(true),
                    VisibilityState::Hidden => visible.set(false),
                    _ => {}
                }
            });

            || drop(listener)
        });
    }

    VisibilityStatus { visible: *visible }
}
