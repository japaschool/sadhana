use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;
use yew_router::prelude::use_navigator;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
    },
    css::*,
    i18n::*,
    services::send_support_message,
};

#[function_component(SupportForm)]
pub fn support_form() -> Html {
    let nav = use_navigator().unwrap();
    let subject = use_state(|| String::default());
    let message = use_state(|| String::default());

    let submit = {
        let subject = subject.clone();
        let message = message.clone();
        use_async(async move { send_support_message(&*subject, &*message).await })
    };

    let onsubmit = {
        let submit = submit.clone();
        Callback::from(move |_| {
            submit.run();
        })
    };

    let oninput_subject = {
        let subject = subject.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            subject.set(input.value());
        })
    };

    let oninput_message = {
        let message = message.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            message.set(input.value());
        })
    };

    html! {
        <BlankPage
            header_label={Locale::current().sf_send_us_message()}
            left_button={HeaderButtonProps::back(nav)}
            >
            <ListErrors error={submit.error.clone()} />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            autocomplete="off"
                            id="subject"
                            type="text"
                            oninput={oninput_subject}
                            class={ INPUT_CSS }
                            placeholder="subject"
                            maxlength="128"
                            required=true
                            />
                        <label for="subject" class={ INPUT_LABEL_CSS }>
                            <i class="fa"></i>
                            { format!(" {}: ", Locale::current().sf_subject()) }
                        </label>
                    </div>
                    <div class="relative">
                        <textarea
                            class={ TEXTAREA_CSS }
                            maxlength="4000"
                            rows="12"
                            required=true
                            placeholder="message"
                            oninput={oninput_message}
                            />
                        <label for="message" class={ INPUT_LABEL_CSS }>
                            <i class="icon-doc"></i>
                            { format!(" {}: ", Locale::current().sf_message()) }
                        </label>
                    </div>
                    <div class="relative">
                        <button class={ SUBMIT_BTN_CSS }>
                        <i class="icon-send"></i>{ format!(" {}", Locale::current().sf_send()) }</button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
