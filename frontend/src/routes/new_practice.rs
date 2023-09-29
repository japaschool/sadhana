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
    model::{NewUserPractice, YatraPractice},
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
        is_required: Option<bool>,
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
                    let new_practice = NewUserPractice {
                        practice: form.practice.trim().to_owned(),
                        data_type: form.data_type.as_str().try_into().unwrap(),
                        is_active: true,
                        is_required: form.is_required,
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

    let required_onclick = {
        let form = form_data.clone();
        Callback::from(move |e: MouseEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_form = (*form).clone();
            new_form.is_required = Some(input.checked());
            form.set(new_form);
        })
    };

    html! {
        <BlankPage
            header_label={ Locale::current().add_new_practice() }
            left_button={ HeaderButtonProps::back(nav) }
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
                    if props.target == NewPracticeTarget::UserPractice {
                        <div class="relative">
                            <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                <span><i class="icon-tick"></i>{format!(" {}: ", Locale::current().is_required())}</span>
                                <input
                                    id="checkbox"
                                    type="checkbox"
                                    onclick={required_onclick.clone()}
                                    />
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">{Locale::current().is_required_memo()}</p>
                            </div>
                        </div>
                    }
                    <div class="relative">
                        <button type="submit" class={ SUBMIT_BTN_CSS }>{ Locale::current().save() }</button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
