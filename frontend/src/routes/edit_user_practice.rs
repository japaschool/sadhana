use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle, use_mount};
use yew_router::prelude::use_navigator;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
    },
    css::*,
    i18n::*,
    model::UserPractice,
    routes::DROPDOWN_PRACTICE_TYPES,
    services::{self, get_user_practice},
    AppRoute,
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub practice: AttrValue,
}

#[function_component(EditUserPractice)]
pub fn edit_user_practice(props: &Props) -> Html {
    let nav = use_navigator().unwrap();
    let practice = use_state(UserPractice::default);
    let is_dropdown = use_bool_toggle(false);

    let current_practice = {
        let p = props.practice.clone();
        use_async(async move { get_user_practice(&p).await.map(|res| res.practice) })
    };

    let update_user_practice = {
        let practice = practice.clone();
        let nav = nav.clone();
        use_async(async move {
            services::update_user_practice(&practice)
                .await
                .map(|_| nav.back())
        })
    };

    {
        let current_practice = current_practice.clone();
        use_mount(move || {
            current_practice.run();
        });
    }

    {
        let practice = practice.clone();
        let is_dropdown = is_dropdown.clone();
        use_effect_with(current_practice.clone(), move |current| {
            is_dropdown.set(
                current
                    .data
                    .as_ref()
                    .map(|p| p.dropdown_variants.is_some())
                    .unwrap_or_default(),
            );
            current.data.iter().for_each(|p| practice.set(p.to_owned()));
            || ()
        });
    }

    let practice_oninput = {
        let practice = practice.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_practice = (*practice).clone();
            new_practice.practice = input.value();
            practice.set(new_practice);
        })
    };

    let required_onclick = {
        let practice = practice.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let mut new_practice = (*practice).clone();
            new_practice.is_required = Some(input.checked());
            practice.set(new_practice);
        })
    };

    let onsubmit = {
        let update_user_practice = update_user_practice.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            update_user_practice.run();
        })
    };

    html! {
            <form {onsubmit}>
                <BlankPage
                    left_button={HeaderButtonProps::back_to(AppRoute::UserPractices)}
                    loading={update_user_practice.loading}
                    header_label={Locale::current().practice()}
                    >
                    <ListErrors error={current_practice.error.clone()} />
                    <ListErrors error={update_user_practice.error.clone()} />
                    <div class={BODY_DIV_CSS}>
                        <div class="relative">
                            <input
                                id="practice"
                                type="text"
                                placeholder="Practice"
                                class={INPUT_CSS}
                                value={practice.practice.clone()}
                                oninput={practice_oninput.clone()}
                                required=true
                                />
                            <label for="practice"
                                class={INPUT_LABEL_CSS}>
                                <i class="icon-doc"></i>{format!(" {}", Locale::current().name())}
                            </label>
                        </div>
                        if *is_dropdown{
                            <div class="relative">
                                <input
                                    id="dropdown_variants"
                                    type="text"
                                    autocomplete="off"
                                    placeholder="Dropdown variants"
                                    class={INPUT_CSS}
                                    value={practice.dropdown_variants.clone()}
                                    oninput={
                                        let practice = practice.clone();
                                        Callback::from(move |e: InputEvent| {
                                            let input: HtmlInputElement = e.target_unchecked_into();
                                            let mut new_practice = (*practice).clone();
                                            let variants = input.value().trim().to_owned();
                                            if !variants.is_empty() {
                                                new_practice.dropdown_variants = Some(variants);
                                            } else {
                                                new_practice.dropdown_variants = None;
                                            }
                                            practice.set(new_practice);
                                        })
                                    }
                                    />
                                <label for="practice"
                                    class={INPUT_LABEL_CSS}>
                                    <i class="icon-doc"></i>{format!(" {}", Locale::current().dropdown_variants())}
                                </label>
                            </div>
                        }
                        if DROPDOWN_PRACTICE_TYPES.contains(&practice.data_type.to_string().as_str()) {
                            <div class="relative">
                                <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                    <span><i class="icon-tick"></i>{format!(" {}: ", Locale::current().is_dropdown())}</span>
                                    <div class="flex">
                                        <input
                                            id="is_required"
                                            type="checkbox"
                                            class={CHECKBOX_INPUT_CSS}
                                            onclick={
                                                let is_dropdown = is_dropdown.clone();
                                                let practice = practice.clone();
                                                Callback::from(move |ev: MouseEvent| {
                                                    let input: HtmlInputElement = ev.target_unchecked_into();
                                                    let checked = input.checked();
                                                    if !checked {
                                                        let mut new_practice = (*practice).clone();
                                                        new_practice.dropdown_variants = None;
                                                        practice.set(new_practice);
                                                    }
                                                    is_dropdown.set(checked);
                                                })
                                            }
                                            checked={*is_dropdown}
                                            />
                                    </div>
                                </label>
                            </div>
                        }
                        <div class="relative">
                            <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                <span><i class="icon-tick"></i>{format!(" {}: ", Locale::current().is_required())}</span>
                                <div class="flex">
                                    <input
                                        id="mandatory"
                                        type="checkbox"
                                        class={CHECKBOX_INPUT_CSS}
                                        onclick={required_onclick.clone()}
                                        checked={practice.is_required.unwrap_or(false)}
                                        />
                                </div>
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">{Locale::current().is_required_memo()}</p>
                            </div>
                        </div>
                        <div class="relative">
                            <button type="submit" class={SUBMIT_BTN_CSS}>{Locale::current().save()}</button>
                        </div>
                    </div>
                </BlankPage>
            </form>
    }
}
