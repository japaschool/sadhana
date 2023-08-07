use common::error::AppError;
use urlencoding::decode;
use wasm_bindgen::JsCast;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::use_navigator;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
    },
    css::*,
    i18n::*,
    model::{UserPractice, YatraPractice},
    services::{create_user_practice, create_yatra_practice},
};

#[derive(Properties, PartialEq)]
pub struct Props {
    pub target: NewPracticeTarget,
    #[prop_or_default]
    pub practice: Option<String>,
}

#[derive(PartialEq, Clone)]
pub enum NewPracticeTarget {
    UserPractice,
    YatraPractice { yatra_id: String },
}

#[function_component(NewPractice)]
pub fn new_practice(props: &Props) -> Html {
    #[derive(Debug, Default, Clone)]
    struct FormData {
        practice: String,
        data_type: String,
    }

    let form_data = use_state(|| FormData {
        practice: props
            .practice
            .iter()
            .flat_map(|p| decode(p).map(|s| s.into_owned()).ok())
            .next()
            .unwrap_or_default(),
        ..FormData::default()
    });
    let nav = use_navigator().unwrap();

    let save = {
        let form = form_data.clone();
        let nav = nav.clone();
        let target = props.target.clone();
        use_async(async move {
            (match target {
                NewPracticeTarget::UserPractice => {
                    let new_practice = UserPractice {
                        practice: form.practice.trim().to_owned(),
                        data_type: form.data_type.as_str().try_into().unwrap(),
                        is_active: true,
                    };
                    create_user_practice(new_practice).await
                }
                NewPracticeTarget::YatraPractice { yatra_id } => {
                    create_yatra_practice(
                        &yatra_id,
                        YatraPractice {
                            practice: form.practice.clone(),
                            data_type: form.data_type.as_str().try_into().unwrap(),
                        },
                    )
                    .await
                }
            })
            .and_then(|_| Ok(nav.back()))
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
            form.practice = input.value().to_owned();
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

    let back_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.back();
        })
    };

    html! {
        <BlankPage
            header_label={ Locale::current().add_new_practice() }
            left_button={ HeaderButtonProps::back(back_onclick) }
            loading={ save.loading }
            >
            <ListErrors error={save.error.clone()} {error_formatter} />
            <form {onsubmit}>
            <div class="justify-center mx-auto max-w-md">
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            autocomplete="off"
                            id="practice_name"
                            type="text"
                            oninput={ practice_oninput.clone() }
                            class={ INPUT_CSS }
                            placeholder="practice_name"
                            pattern="[^\\s]+?.*"
                            maxlength="64"
                            required=true
                            disabled={props.practice.is_some()}
                            value={form_data.practice.clone()}
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
                            <option class={ "text-black" } value="int">{ Locale::current().integer() }</option>
                            <option class={ "text-black" } value="time">{ Locale::current().time() }</option>
                            <option class={ "text-black" } value="bool">{ Locale::current().boolean() }</option>
                            <option class={ "text-black" } value="text">{ Locale::current().text() }</option>
                            <option class={ "text-black" } value="duration">{ Locale::current().duration_in_mins() }</option>
                            <option class={ "text-black" } value="" selected=true disabled=true style="display:none">{ Locale::current().select_data_type() }</option>
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
                </div>
            </form>
        </BlankPage>
    }
}
