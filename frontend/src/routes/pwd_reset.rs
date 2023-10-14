use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
        pwd::Pwd,
    },
    css::*,
    i18n::Locale,
    model,
    routes::AppRoute,
    services,
};
use common::error::AppError;
use gloo_dialogs::alert;
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle, use_mount};
use yew_router::prelude::{use_navigator, Redirect};

#[derive(Properties, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: AttrValue,
}

#[function_component(PwdReset)]
pub fn pwd_reset(props: &Props) -> Html {
    let pwd = use_state(|| String::default());

    let pwd_onchange = {
        let pwd = pwd.clone();
        Callback::from(move |new_pwd: String| {
            pwd.set(new_pwd);
        })
    };

    let email = {
        let confirmation_id = props.id.clone();
        use_async(async move { services::get_signup_link_details(confirmation_id.as_str()).await })
    };

    {
        let email = email.clone();
        use_mount(move || {
            email.run();
        });
    }

    let finished = use_bool_toggle(false);

    let reset_pwd = {
        let email = email.clone();
        let pwd = pwd.clone();
        let finished = finished.clone();
        use_async(async move {
            services::reset_pwd(model::ResetPassword {
                confirmation_id: email.data.as_ref().unwrap().confirmation.id.clone(),
                password: (*pwd).clone(),
            })
            .await
            .map(|_| {
                finished.toggle();
            })
        })
    };

    let onsubmit = {
        let reset_pwd = reset_pwd.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            reset_pwd.run();
        })
    };

    let error_formatter = {
        Callback::from(move |err| match err {
            AppError::NotFound => Some(Locale::current().invalid_reset_link()),
            _ => None,
        })
    };

    if *finished {
        alert(&Locale::current().reset_success_alert());
        return html! {
            <Redirect<AppRoute> to={AppRoute::Login}/>
        };
    }

    html! {
        <BlankPage header_label={ Locale::current().password_reset() }
            loading={ email.loading || reset_pwd.loading }
            left_button={HeaderButtonProps::back_to(AppRoute::Home)}
            >
            <ListErrors error={ email.error.clone() } error_formatter = { error_formatter.clone() } />
            <ListErrors error={ reset_pwd.error.clone() } error_formatter = { error_formatter.clone() } />
            if email.error.is_none() {
                <form {onsubmit}>
                    <div class={ BODY_DIV_CSS }>
                        <Pwd onchange={ pwd_onchange }/>
                        <div class="relative">
                            <button class={ SUBMIT_BTN_CSS }>{ Locale::current().save() }</button>
                        </div>
                    </div>
                </form>
            }
        </BlankPage>
    }
}
