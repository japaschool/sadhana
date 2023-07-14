use yew::prelude::*;
use yew_router::prelude::*;

use self::{
    about::About,
    charts::{Charts, SharedCharts},
    confirmation::Confirmation,
    edit_password::EditPassword,
    edit_user::EditUser,
    help::Help,
    home::Home,
    login::Login,
    new_user_practice::NewUserPractice,
    pwd_reset::PwdReset,
    register_with_id::RegisterWithId,
    settings::Settings,
    user_practices::UserPractices,
    yatras::Yatras,
};
use crate::{components::user_context_provider::UserContextProvider, model::ConfirmationType};

pub mod about;
pub mod charts;
pub mod confirmation;
pub mod edit_password;
pub mod edit_user;
pub mod help;
pub mod home;
pub mod login;
pub mod new_user_practice;
pub mod pwd_reset;
pub mod register_with_id;
pub mod settings;
pub mod user_practices;
pub mod yatras;

/// Routes that need not user cntext to be loaded
#[derive(Clone, Routable, PartialEq)]
pub enum BaseRoute {
    #[at("/reset")]
    PasswordReset,
    #[at("/reset/:id")]
    PasswordResetWithConfirmationId { id: String },
    #[at("/register")]
    Register,
    #[at("/shared/:id")]
    SharedCharts { id: String },
    #[at("/*")]
    AppRoute,
    #[at("/")]
    Home,
}

/// Routes that depend on user context being loaded
#[derive(Clone, Routable, PartialEq)]
pub enum AppRoute {
    #[at("/")]
    Home,
    #[at("/register/:id")]
    RegisterWithConfirmationId { id: String },
    #[at("/login")]
    Login,
    #[at("/settings")]
    Settings,
    #[at("/edit-user")]
    EditUser,
    #[at("/edit-password")]
    EditPassword,
    #[at("/help")]
    Help,
    #[at("/about")]
    About,
    #[at("/user/practices")]
    UserPractices,
    #[at("/user/practice/new")]
    NewUserPractice,
    #[at("/charts")]
    Charts,
    #[at("/yatras")]
    Yatras,
    #[not_found]
    #[at("/404")]
    NotFound,
}

fn app_switch(routes: AppRoute) -> Html {
    match routes {
        AppRoute::Home => html! { <Home /> },
        AppRoute::RegisterWithConfirmationId { id } => html! { <RegisterWithId id={id} /> },
        AppRoute::Login => html! { <Login /> },
        AppRoute::Settings => html! { <Settings /> },
        AppRoute::EditUser => html! { <EditUser/> },
        AppRoute::EditPassword => html! { <EditPassword/> },
        AppRoute::Help => html! { <Help/> },
        AppRoute::About => html! { <About/> },
        AppRoute::UserPractices => html! { <UserPractices /> },
        AppRoute::NewUserPractice => html! { <NewUserPractice /> },
        AppRoute::Charts => html! { <Charts/> },
        AppRoute::Yatras => html! { <Yatras/> },
        AppRoute::NotFound => html! { <h1>{ "404" }</h1> },
    }
}

pub fn switch(routes: BaseRoute) -> Html {
    match routes {
        BaseRoute::PasswordReset => {
            html! { <Confirmation confirmation_type={ConfirmationType::PasswordReset} /> }
        }
        BaseRoute::PasswordResetWithConfirmationId { id } => html! { <PwdReset id={id} /> },
        BaseRoute::Register => {
            html! { <Confirmation confirmation_type={ConfirmationType::Registration} /> }
        }
        BaseRoute::SharedCharts { id } => html! { <SharedCharts share_id={id}/> },
        BaseRoute::Home | BaseRoute::AppRoute => {
            html! { <UserContextProvider><Switch<AppRoute> render={app_switch} /></UserContextProvider> }
        }
    }
}
