use yew::prelude::*;

use crate::hooks::use_user_context;

// use super::AppRoute;

#[function_component(Home)]
pub fn home() -> Html {
    let user_ctx = use_user_context();

    log::debug!(
        "Rendering home. Current user is_authenticated is {:?}",
        user_ctx
    );

    html! {
        <h1>{"Home Page"}</h1>
    }
    // FIXME: when user opens home page display login screen if there's no valid token in the storage
    // The code below does not work cause user context gets refreshed only after the page rendering
    // is finished. Had we stayed on the home page it would have triggerred re-rendering. But we
    // redirect prematurely.
    // We could incorporate login page into the home page instead of relying on redirection.

    // if user_ctx.is_authenticated() {
    //     html! {<h1>{"Home Page"}</h1>}
    // } else {
    //     user_ctx.redirect_to(AppRoute::Login);
    //     html! {}
    // }
}
