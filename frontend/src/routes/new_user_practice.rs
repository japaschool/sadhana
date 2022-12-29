use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;

use crate::{
    hooks::use_user_context, model::CreateUserPractice, routes::AppRoute,
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
        Callback::from(move |e: FocusEvent| {
            e.prevent_default();
            save.run();
            user_ctx.redirect_to(AppRoute::UserPractices);
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
        <div>
            <form {onsubmit}>
                <fieldset>
                    <input
                        type="text"
                        name="Practice"
                        oninput={ practice_oninput }
                        required=true
                        />
                    <select
                        name="data type"
                        onchange={ data_type_onchange }
                        required=true >
                        <option value="" selected=true style="display:none">{ "Select data type" }</option>
                        <option value="int">{ "Integer" }</option>
                        <option value="time">{ "Time" }</option>
                        <option value="bool">{ "Boolean" }</option>
                        <option value="text">{ "Text" }</option>
                    </select>
                </fieldset>
                <button type="submit">{ "Save" }</button>
            </form>
        </div>
    }
}
