use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;

use crate::{i18n::Locale, model::SendSignupLink, services};

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

    return html! {
        if *email_sent {
            <div>
                <label>{ Locale::current().signup_email_sent() }</label>
            </div>
        } else {
            <div>
                <form onsubmit={onsubmit_signup}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={ (*signup_email).clone() }
                        oninput={ oninput_signup_email }
                        required = true
                        />
                    <button
                        type="submit"
                        disabled=false
                        >
                        { Locale::current().sign_up() }
                    </button>
                </form>
            </div>
        }
    };
}
