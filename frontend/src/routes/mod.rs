use yew::prelude::*;
use yew_router::prelude::*;

use self::{
    charts::Charts, home::Home, login::Login, new_user_practice::NewUserPractice,
    register::Register, register_with_id::RegisterWithId, settings::Settings,
    user_practices::UserPractices,
};

pub mod charts;
pub mod home;
pub mod login;
pub mod new_user_practice;
pub mod register;
pub mod register_with_id;
pub mod settings;
pub mod user_practices;

#[derive(Clone, Routable, PartialEq)]
pub enum AppRoute {
    #[at("/")]
    Home,
    #[at("/register")]
    Register,
    #[at("/register/:id")]
    RegisterWithId { id: String },
    #[at("/login")]
    Login,
    #[at("/settings")]
    Settings,
    #[at("/user/practices")]
    UserPractices,
    #[at("/user/practice/new")]
    NewUserPractice,
    #[at("/charts")]
    Charts,
    #[not_found]
    #[at("/404")]
    NotFound,
}

pub fn switch(routes: AppRoute) -> Html {
    match routes {
        AppRoute::Home => html! { <Home /> },
        AppRoute::Register => html! { <Register /> },
        AppRoute::RegisterWithId { id } => html! { <RegisterWithId id = {id} /> },
        AppRoute::Login => html! { <Login /> },
        AppRoute::Settings => html! { <Settings /> },
        AppRoute::UserPractices => html! { <UserPractices /> },
        AppRoute::NewUserPractice => html! { <NewUserPractice /> },
        AppRoute::Charts => html! { <Charts/> },
        AppRoute::NotFound => html! { <h1>{ "404" }</h1> },
    }
}
