use yew::prelude::*;
use yew_router::prelude::*;

use home::Home;
use login::Login;
use register::Register;

pub mod home;
pub mod login;
pub mod register;

#[derive(Clone, Routable, PartialEq)]
pub enum AppRoute {
    #[at("/")]
    Home,
    #[at("/register")]
    Register,
    #[at("/login")]
    Login,
    #[not_found]
    #[at("/404")]
    NotFound,
}

pub fn switch(routes: &AppRoute) -> Html {
    match routes {
        AppRoute::Home => html! { <Home /> },
        AppRoute::Register => html! { <Register /> },
        AppRoute::Login => html! { <Login /> },
        AppRoute::NotFound => html! { <h1>{ "404" }</h1> },
    }
}
