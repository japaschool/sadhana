use gloo::utils::window;
use gloo_events::EventListener;
use web_sys::VisibilityState;
use yew::prelude::*;

#[hook]
pub fn use_on_wake(callback: Callback<()>) {
    use_visibility(callback, Callback::default())
}

/// Calls `on_visible` when app becomes visible,
/// `on_hidden` when app goes to background.
#[hook]
pub fn use_visibility(on_visible: Callback<()>, on_hidden: Callback<()>) {
    // Using effect with deps to avoid running on ever render
    use_effect_with((), move |_| {
        let document = window().document().expect("no document");

        let listener = EventListener::new(&window(), "visibilitychange", move |_| {
            match document.visibility_state() {
                VisibilityState::Visible => on_visible.emit(()),
                VisibilityState::Hidden => on_hidden.emit(()),
                _ => {}
            }
        });

        || drop(listener)
    });
}
