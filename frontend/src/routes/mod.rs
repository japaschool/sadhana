use yew::prelude::*;
use yew_router::prelude::*;

use self::{
    home::Home, login::Login, new_user_practice::NewUserPractice, register::Register,
    user_practices::UserPractices,
};

pub mod home;
pub mod login;
pub mod new_user_practice;
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
    #[at("/user/practices")]
    UserPractices,
    #[at("/user/practice/new")]
    NewUserPractice,
    #[not_found]
    #[at("/404")]
    NotFound,
}

pub fn switch(routes: AppRoute) -> Html {
    match routes {
        AppRoute::Home => html! { <Home /> },
        AppRoute::Register => html! { <Register /> },
        AppRoute::Login => html! { <Login /> },
        AppRoute::UserPractices => html! { <UserPractices /> },
        AppRoute::NewUserPractice => html! { <NewUserPractice /> },
        AppRoute::NotFound => html! { <h1>{ "404" }</h1> },
    }
}
