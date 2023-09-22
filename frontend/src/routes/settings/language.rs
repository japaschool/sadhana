use crate::{
    components::blank_page::BlankPage,
    css::*,
    i18n::{Locale, DEFAULT_LANGUAGE_KEY, LANGUAGE_DATA, USER_LANGUAGE_STORAGE_KEY},
    routes::AppRoute,
};
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;

#[function_component(Language)]
pub fn language() -> Html {
    let stored_language = LocalStorage::get::<String>(USER_LANGUAGE_STORAGE_KEY)
        .unwrap_or(DEFAULT_LANGUAGE_KEY.to_owned());

    let is_checked_lang = |s: &str| -> bool { stored_language == s };

    let reload = use_force_update();

    let language_onchange = {
        let reload = reload.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();

            if input.value() == DEFAULT_LANGUAGE_KEY {
                LocalStorage::delete(USER_LANGUAGE_STORAGE_KEY);
            } else {
                LocalStorage::set(USER_LANGUAGE_STORAGE_KEY, input.value()).unwrap();
            }

            reload.force_update();
        })
    };

    html! {
        <BlankPage
            show_footer=true
            selected_page={AppRoute::Settings}
            prev_link={ (Locale::current().back(), AppRoute::Settings) }
            header_label={ Locale::current().language() }
            >
            <div class={ BODY_DIV_CSS }>
                <div class="relative">
                    <select
                        class={ INPUT_CSS }
                        id="language"
                        onchange={ language_onchange }
                        required=true
                        >
                        <option class={ "text-black" } value={ DEFAULT_LANGUAGE_KEY } selected={ is_checked_lang(DEFAULT_LANGUAGE_KEY) }>{ Locale::current().default_language().as_str() }</option>
                        {
                            LANGUAGE_DATA
                                .iter()
                                .map(|(s, s_full)| html! {
                                    <option class={ "text-black" } value={ s.to_owned() } selected={ is_checked_lang(s) }>{ s_full }</option>
                                })
                                .collect::<Html>()
                        }
                    </select>
                    <label for="language" class={ INPUT_LABEL_CSS }>
                        <i class="icon-lang"></i>
                        { format!(" {}: ", Locale::current().language()) }
                    </label>
                </div>
            </div>
        </BlankPage>
    }
}
