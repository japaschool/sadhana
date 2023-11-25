use yew::prelude::*;
use yew_router::prelude::*;

use self::{
    charts::{create_report::CreateReport, Charts, SharedCharts},
    confirmation::Confirmation,
    edit_user_practice::EditUserPractice,
    home::Home,
    login::Login,
    new_practice::{NewPractice, NewPracticeTarget},
    pwd_reset::PwdReset,
    register_with_id::RegisterWithId,
    settings::{
        about::About, edit_password::EditPassword, edit_user::EditUser, help::Help, import::Import,
        language::Language, support_form::SupportForm, Settings,
    },
    user_practices::UserPractices,
    yatras::{admin_settings::AdminSettings, join::JoinYatra, settings::YatraSettings, Yatras},
};
use crate::{components::user_context_provider::UserContextProvider, model::ConfirmationType};

pub mod charts;
pub mod confirmation;
pub mod edit_user_practice;
pub mod home;
pub mod login;
pub mod new_practice;
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
    #[at("/settings/about")]
    About,
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
    #[at("/settings/edit-user")]
    EditUser,
    #[at("/settings/edit-password")]
    EditPassword,
    #[at("/settings/help")]
    Help,
    #[at("/settings/help/support-form")]
    SupportForm,
    #[at("/settings/import")]
    Import,
    #[at("/settings/language")]
    Language,
    #[at("/user/practices")]
    UserPractices,
    #[at("/user/practice/new")]
    NewUserPractice,
    #[at("/user/practice/:practice/edit")]
    EditUserPractice { practice: String },
    #[at("/user/practice/new/:practice")]
    NewUserPracticeWithName { practice: String },
    #[at("/charts")]
    Charts,
    #[at("/charts/new")]
    NewReport,
    #[at("/yatras")]
    Yatras,
    #[at("/yatra/:id/join")]
    JoinYatra { id: String },
    #[at("/yatra/:id/settings")]
    YatraSettings { id: String },
    #[at("/yatra/:id/admin/settings")]
    YatraAdminSettings { id: String },
    #[at("/yatra/:id/practice/new")]
    NewYatraPractice { id: String },
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
        AppRoute::SupportForm => html! { <SupportForm/> },
        AppRoute::Help => html! { <Help/> },
        AppRoute::Import => html! { <Import/> },
        AppRoute::Language => html! { <Language/> },
        AppRoute::UserPractices => html! { <UserPractices /> },
        AppRoute::NewUserPractice => {
            html! { <NewPractice target={ NewPracticeTarget::UserPractice } /> }
        }
        AppRoute::EditUserPractice { practice } => {
            html! { <EditUserPractice practice={practice}/> }
        }
        AppRoute::NewUserPracticeWithName { practice } => {
            html! { <NewPractice target={NewPracticeTarget::UserPractice} practice={practice} /> }
        }
        AppRoute::Charts => html! { <Charts/> },
        AppRoute::NewReport => html! { <CreateReport/> },
        AppRoute::Yatras => html! { <Yatras/> },
        AppRoute::JoinYatra { id } => html! { <JoinYatra yatra_id={id}/> },
        AppRoute::YatraSettings { id } => html! { <YatraSettings yatra_id={id}/> },
        AppRoute::YatraAdminSettings { id } => html! { <AdminSettings yatra_id={id}/> },
        AppRoute::NewYatraPractice { id } => {
            html! { <NewPractice target={ NewPracticeTarget::YatraPractice { yatra_id: id } } /> }
        }
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
        BaseRoute::About => html! { <About/> },
        BaseRoute::Home | BaseRoute::AppRoute => {
            html! { <UserContextProvider><Switch<AppRoute> render={app_switch} /></UserContextProvider> }
        }
    }
}
