use crate::css::*;
use common::error::AppError;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    i18n::*,
    model::SendSignupLink,
    services, AppRoute,
};

#[function_component(Register)]
pub fn register() -> Html {
    let signup_email = use_state(|| "".to_string());
    let email_sent = use_state(|| false);

    let oninput_signup_email = {
        let signup_email = signup_email.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            signup_email.set(input.value());
        })
    };

    let send_signup_email = {
        let signup_email = signup_email.clone();
        let email_sent = email_sent.clone();
        use_async(async move {
            let res = services::send_signup_link(SendSignupLink {
                email: (*signup_email).clone(),
            })
            .await;
            email_sent.set(true);
            res
        })
    };

    let onsubmit_signup = {
        let send_signup_email = send_signup_email.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default(); /* Prevent event propagation */
            send_signup_email.run();
        })
    };

    let error_formatter = {
        let email = signup_email.clone();
        Callback::from(move |err| match err {
            AppError::UnprocessableEntity(err)
                if err
                    .iter()
                    .find(|s| s.ends_with("already exists."))
                    .is_some() =>
            {
                Some(Locale::current().user_already_exists(Email(&*email)))
            }
            _ => None,
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().register() }>
            <ListErrors error={send_signup_email.error.clone()} {error_formatter} />
            <form onsubmit={onsubmit_signup}>
                <div class={ BODY_DIV_CSS }>
                    if *email_sent && send_signup_email.error.is_none() {
                        <div class="relative">
                            <label>{ Locale::current().signup_email_sent() }</label>
                        </div>
                    } else {
                        <div class="relative">
                            <input
                                id="email"
                                type="email"
                                placeholder="Email"
                                class={ INPUT_CSS }
                                value={ (*signup_email).clone() }
                                oninput={ oninput_signup_email }
                                required = true
                                />
                            <label for="email"
                                class={ INPUT_LABEL_CSS }>
                                <i class="fa fa-envelope"></i>{ format!(" {}", Locale::current().email_address()) }
                            </label>
                        </div>
                        <div class="relative flex justify-between sm:text-sm">
                            <Link<AppRoute>
                                classes={ LINK_CSS }
                                to={AppRoute::Login}>{ Locale::current().have_an_account() }
                            </Link<AppRoute>>
                        </div>
                        <div class="relative">
                            <button class={ SUBMIT_BTN_CSS }>{ Locale::current().sign_up() }</button>
                        </div>
                    }
                </div>
            </form>
        </BlankPage>
    }
}
