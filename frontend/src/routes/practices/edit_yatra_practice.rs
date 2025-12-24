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
    model::YatraPractice,
    services::{get_yatra_practice, update_yatra_practice},
    AppRoute,
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
    pub practice_id: AttrValue,
}

#[function_component(EditYatraPractice)]
pub fn edit_yatra_practice(props: &Props) -> Html {
    let nav = use_navigator().unwrap();
    let practice = use_state(YatraPractice::default);

    let current_practice = {
        let practice_id = props.practice_id.clone();
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            get_yatra_practice(&yatra_id, &practice_id)
                .await
                .map(|res| res.practice)
        })
    };

    let update_practice = {
        let practice = practice.clone();
        let nav = nav.clone();
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            update_yatra_practice(&yatra_id, &practice)
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
        use_effect_with(current_practice.clone(), move |current| {
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

    let onsubmit = {
        let update_user_practice = update_practice.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            update_user_practice.run();
        })
    };

    html! {
        <form {onsubmit}>
            <BlankPage
                left_button={HeaderButtonProps::back_to(AppRoute::UserPractices)}
                loading={update_practice.loading}
                header_label={Locale::current().practice()}
                >
                <ListErrors error={current_practice.error.clone()} />
                <ListErrors error={update_practice.error.clone()} />
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
                        <button type="submit" class={SUBMIT_BTN_CSS}>{Locale::current().save()}</button>
                    </div>
                </div>
            </BlankPage>
        </form>
    }
}
