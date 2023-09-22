use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::use_navigator;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::*,
    model::UserPractice,
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
    let practice = use_state(|| UserPractice::default());

    let current_practice = {
        let p = props.practice.clone();
        use_async(async move { get_user_practice(&p).await.map(|res| res.practice) })
    };

    let update_user_practice = {
        let practice = practice.clone();
        let nav = nav.clone();
        use_async(async move {
            services::update_user_practice(&*practice)
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
        use_effect_with_deps(
            move |current| {
                current.data.iter().for_each(|p| practice.set(p.to_owned()));
                || ()
            },
            current_practice.clone(),
        );
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
                    prev_link={(Locale::current().cancel(), AppRoute::UserPractices)}
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
                        <div class="relative">
                            <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                <span><i class="icon-tick"></i>{format!(" {}: ", Locale::current().is_required())}</span>
                                <input
                                    id="checkbox"
                                    type="checkbox"
                                    onclick={required_onclick.clone()}
                                    checked={practice.is_required.unwrap_or(false)}
                                    />
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
