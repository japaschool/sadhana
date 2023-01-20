use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    model::CreateUserPractice,
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
        use_async(async move {
            let new_practice = CreateUserPractice {
                practice: form.practice.clone(),
                data_type: form.data_type.as_str().try_into().unwrap(),
            };
            create_user_practice(&new_practice).await
        })
    };

    let onsubmit = {
        let save = save.clone();
        let user_ctx = user_ctx.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            save.run();
            user_ctx.redirect_to(&AppRoute::UserPractices);
        })
    };

    let practice_oninput = {
        let form_data = form_data.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();
            let mut form = (*form_data).clone();
            form.practice = input.value();
            form_data.set(form);
            log::debug!("Form data has changed: {:?}", *form_data);
        })
    };

    let data_type_onchange = {
        Callback::from(move |e: Event| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();
            let mut form = (*form_data).clone();
            form.data_type = input.value();
            form_data.set(form);
            log::debug!("Form data has changed: {:?}", *form_data);
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().select_practices() } prev_link={ (Locale::current().cancel(), AppRoute::UserPractices) }>
            <ListErrors error={save.error.clone()} />
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
                            <option value="" selected=true style="display:none">{ Locale::current().select_data_type() }</option>
                            <option value="int">{ Locale::current().integer() }</option>
                            <option value="time">{ Locale::current().time() }</option>
                            <option value="bool">{ Locale::current().boolean() }</option>
                            <option value="text">{ Locale::current().text() }</option>
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
