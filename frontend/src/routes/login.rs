use common::error::AppError;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::*,
    model::*,
    services, BaseRoute,
};

#[function_component(Login)]
pub fn login() -> Html {
    let user_ctx = use_user_context();
    let login_info = use_state(|| LoginInfo::default());
    let user_login = {
        let login_info = login_info.clone();
        use_async(async move {
            let request = LoginInfoWrapper {
                user: (*login_info).clone(),
            };
            services::login(&request).await
        })
    };

    /* Hook into changes of user_login */
    use_effect_with_deps(
        move |user_login| {
            if let Some(user_info) = &user_login.data {
                user_ctx.login(user_info.user.clone());
            }
            || ()
        },
        user_login.clone(),
    );

    let onsubmit = {
        let user_login = user_login.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default(); /* Prevent event propagation */
            user_login.run();
        })
    };

    let oninput_email = {
        let login_info = login_info.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut info = (*login_info).clone();
            info.email = input.value();
            login_info.set(info);
        })
    };

    let oninput_password = {
        let login_info = login_info.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut info = (*login_info).clone();
            info.password = input.value();
            login_info.set(info);
        })
    };

    let error_formatter = {
        let login_info = login_info.clone();
        Callback::from(move |err| match err {
            AppError::NotFound => Some(Locale::current().login_not_found(Email(&login_info.email))),
            _ => None,
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().login() } loading={ user_login.loading }>
            <ListErrors error={ user_login.error.clone() } error_formatter={ error_formatter } />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            type="email"
                            id="email"
                            placeholder="Email"
                            value={login_info.email.clone()}
                            oninput={oninput_email}
                            class={ INPUT_CSS }
                            required = true
                            />
                        <label for="email" class={ INPUT_LABEL_CSS }>
                            <i class="icon-mail"></i>{ format!(" {}", Locale::current().email_address()) }
                        </label>
                    </div>
                    <div class="relative">
                        <input
                            autocomplete="off"
                            id="password"
                            type="password"
                            placeholder="Password"
                            class={ INPUT_CSS }
                            value={login_info.password.clone()}
                            oninput={oninput_password}
                            required = true
                            />
                        <label for="password"
                            class={ INPUT_LABEL_CSS }>
                            <i class="icon-key"></i>{ format!(" {}", Locale::current().password()) }
                        </label>
                    </div>
                    <div class="relative">
                        <button class={ SUBMIT_BTN_CSS }>
                        <i class="icon-login"></i>{ format!(" {}", Locale::current().sign_in()) }</button>
                    </div>
                    <div class={ LINKS_CSS }>
                        <Link<BaseRoute>
                            classes={ LINK_CSS }
                            to={BaseRoute::PasswordReset}>{ Locale::current().forgot_password() }
                        </Link<BaseRoute>>
                        <Link<BaseRoute>
                            classes={ LINK_CSS }
                            to={BaseRoute::About}>{ Locale::current().about() }
                        </Link<BaseRoute>>
                        <Link<BaseRoute>
                            classes={ LINK_CSS_NEW_ACC }
                            to={BaseRoute::Register}>{ Locale::current().need_an_account() }
                        </Link<BaseRoute>>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
