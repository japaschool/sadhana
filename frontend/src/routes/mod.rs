use yew::prelude::*;
use yew_router::prelude::*;

use home::Home;
use login::Login;
use register::Register;

use self::user_practices::UserPractices;

pub mod home;
pub mod login;
pub mod register;
pub mod user_practices;

#[derive(Clone, Routable, PartialEq)]
pub enum AppRoute {
    #[at("/")]
    Home,
    #[at("/register")]
    Register,
    #[at("/login")]
    Login,
    #[at("/user_practices")]
    UserPractices,
    #[not_found]
    #[at("/404")]
    NotFound,
}

pub fn switch(routes: &AppRoute) -> Html {
    match routes {
        AppRoute::Home => html! { <Home /> },
        AppRoute::Register => html! { <Register /> },
        AppRoute::Login => html! { <Login /> },
        AppRoute::UserPractices => html! { <UserPractices /> },
        AppRoute::NotFound => html! { <h1>{ "404" }</h1> },
    }
}
