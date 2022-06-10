use yew::prelude::*;

use crate::hooks::use_user_context;

use super::AppRoute;

#[function_component(Home)]
pub fn home() -> Html {
    let user_ctx = use_user_context();

    if user_ctx.is_authenticated() {
        html! {<h1>{"Home Page"}</h1>}
    } else {
        user_ctx.redirect_to(AppRoute::Login);
        html! {}
    }
}
