use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    model::*,
    services, AppRoute,
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
            services::login(request).await
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

    html! {
        <BlankPage header_label={ Locale::current().login() }>
            <ListErrors error={user_login.error.clone()} />
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
                            <i class="fa fa-envelope"></i>{ format!(" {}", Locale::current().email_address()) }
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
                            <i class="fa fa-key"></i>{ format!(" {}", Locale::current().password()) }
                        </label>
                    </div>
                    <div class="relative flex justify-between sm:text-sm">
                        <a>{"Forgot password?"}</a>
                        <Link<AppRoute>
                            classes={ LINK_CSS }
                            to={AppRoute::Register}>{ Locale::current().need_an_account() }
                        </Link<AppRoute>>
                    </div>
                    <div class="relative">
                        <button class={ SUBMIT_BTN_CSS }>{ Locale::current().sign_in() }</button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
