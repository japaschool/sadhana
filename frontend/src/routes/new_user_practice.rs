use common::error::AppError;
use wasm_bindgen::JsCast;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::*,
    model::UserPractice,
    routes::AppRoute,
    services::create_user_practice,
};

#[function_component(NewUserPractice)]
pub fn new_user_practice() -> Html {
    #[derive(Debug, Default, Clone)]
    struct FormData {
        practice: String,
        data_type: String,
    }

    let user_ctx = use_user_context();
    let form_data = use_state(|| FormData::default());
    let save = {
        let form = form_data.clone();
        let user_ctx = user_ctx.clone();
        use_async(async move {
            let new_practice = UserPractice {
                practice: form.practice.clone(),
                data_type: form.data_type.as_str().try_into().unwrap(),
                is_active: true,
            };
            create_user_practice(new_practice)
                .await
                .and_then(|_| Ok(user_ctx.redirect_to(&AppRoute::UserPractices)))
        })
    };

    let onsubmit = {
        let save = save.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            save.run();
        })
    };

    let practice_oninput = {
        let form_data = form_data.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();
            let mut form = (*form_data).clone();
            form.practice = input.value().trim().to_owned();
            form_data.set(form);
        })
    };

    let data_type_onchange = {
        let form_data = form_data.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();

            if !input.value().is_empty() {
                input.set_custom_validity("");
            }

            let mut form = (*form_data).clone();
            form.data_type = input.value();
            form_data.set(form);
        })
    };

    {
        use_mount(move || {
            if let Some(element) = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.get_element_by_id("data_type"))
            {
                let html: HtmlInputElement = element.unchecked_into();
                html.set_custom_validity(&Locale::current().data_type_cant_be_empty());
            }
        });
    }

    let error_formatter = {
        let form = form_data.clone();
        Callback::from(move |err| match err {
            AppError::UnprocessableEntity(err)
                if err.iter().find(|s| s.contains("already exists.")).is_some() =>
            {
                Some(Locale::current().practice_already_exists(PracticeName(&form.practice)))
            }
            _ => None,
        })
    };

    html! {
        <BlankPage
            header_label={ Locale::current().select_practices() }
            prev_link={ (Locale::current().cancel(), AppRoute::UserPractices) }
            loading={ save.loading }
            >
            <ListErrors error={save.error.clone()} {error_formatter} />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            autocomplete="off"
                            id="practice_name"
                            type="text"
                            oninput={ practice_oninput.clone() }
                            class={ INPUT_CSS }
                            placeholder="practice_name"
                            required=true
                            />
                        <label for="practice_name" class={ INPUT_LABEL_CSS }>
                            <i class="fa"></i>
                            { format!(" {}: ", Locale::current().practice_name()) }
                        </label>
                    </div>
                    <div class="relative">
                        <select
                            class={ INPUT_CSS }
                            id="data_type"
                            onchange={ data_type_onchange }
                            required=true >
                            <option value="int">{ Locale::current().integer() }</option>
                            <option value="time">{ Locale::current().time() }</option>
                            <option value="bool">{ Locale::current().boolean() }</option>
                            <option value="text">{ Locale::current().text() }</option>
                            <option value="duration">{ Locale::current().duration() }</option>
                            <option value="" selected=true disabled=true style="display:none">{ Locale::current().select_data_type() }</option>
                        </select>
                        <label for="data_type" class={ INPUT_LABEL_CSS }>
                            <i class="fa"></i>
                            { format!(" {}: ", Locale::current().data_type()) }
                        </label>
                    </div>
                    <div class="relative">
                        <button type="submit" class={ SUBMIT_BTN_CSS }>{ Locale::current().save() }</button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
