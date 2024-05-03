use crate::{
    components::blank_page::BlankPage,
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    routes::{AppRoute, BaseRoute},
};
use gloo::storage::{LocalStorage, Storage};
use inflector::Inflector;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_router::prelude::use_navigator;

pub mod about;
pub mod edit_password;
pub mod edit_user;
pub mod help;
pub mod import;
pub mod language;
pub mod support_form;

#[function_component(Settings)]
pub fn settings() -> Html {
    let user_ctx = use_user_context();
    let nav = use_navigator().unwrap();

    let logout_onclick = {
        let user_ctx = user_ctx.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            user_ctx.logout();
        })
    };

    let dark_mode_onclick = {
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            if let Some(de) = web_sys::window()
                .and_then(|w| w.document())
                .and_then(|d| d.document_element())
            {
                if input.checked() {
                    LocalStorage::set("color-theme", "dark").unwrap();
                    de.class_list().add_1("dark").unwrap();
                } else {
                    LocalStorage::delete("color-theme");
                    de.class_list().remove_1("dark").unwrap();
                }
            }
        })
    };

    let edit_user_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::EditUser);
        })
    };
    let edit_password_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::EditPassword);
        })
    };
    let language_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::Language);
        })
    };
    let help_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&BaseRoute::Help);
        })
    };
    let about_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&BaseRoute::About);
        })
    };
    let import_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::Import);
        })
    };

    const UL_CSS: &str =
        "pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500";
    const LI_DIV_CSS: &str =
        "relative flex justify-between items-center sm:text-base align-baseline";

    fn menu_li(icon: &str, label: String) -> Html {
        html! {
            <li>
                <div class={LI_DIV_CSS}>
                    <label>
                        <i class={format!("{icon} flex-shrink-0 w-5")}></i>
                        { label }
                    </label>
                    <i class="icon-chevron-right"></i>
                </div>
            </li>
        }
    }

    html! {
        <BlankPage show_footer=true selected_page={AppRoute::Settings} header_label={user_ctx.name.clone()}>
            <div class={ format!("space-y-4 pt-14 mx-auto max-w-md {}", BODY_DIV_BASE_CSS) }>
                <ul onclick={ edit_user_onclick } class={UL_CSS}>
                    { menu_li("icon-user", Locale::current().user_details().to_sentence_case()) }
                </ul>
                <ul onclick={ edit_password_onclick } class={UL_CSS}>
                    { menu_li("icon-edit", Locale::current().change_password()) }
                </ul>
                <ul onclick={ language_onclick } class={UL_CSS}>
                    { menu_li("icon-lang", Locale::current().language()) }
                </ul>
                <ul class={UL_CSS}>
                    <li>
                        <div class={LI_DIV_CSS}>
                            <label for="toggle"><i class="icon-moon flex-shrink-0 w-5"></i>{ Locale::current().dark_mode() }</label>
                            <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in ml-7">
                                <input
                                    type="checkbox"
                                    name="dark_toggle"
                                    id="dark_toggle"
                                    onclick={ dark_mode_onclick.clone() }
                                    checked={ LocalStorage::get("color-theme").map(|v: String| v == "dark").unwrap_or(false) }
                                    class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                                    />
                                <label
                                    for="dark_toggle"
                                    class="toggle-label block overflow-hidden h-6 rounded-full bg-zinc-400 dark:bg-zinc-300 cursor-pointer">
                                </label>
                            </div>
                        </div>
                    </li>
                </ul>
                <ul onclick={ import_onclick } class={UL_CSS}>
                    { menu_li("icon-import", Locale::current().import_csv() ) }
                </ul>
                <ul class={UL_CSS}>
                    <li onclick={ help_onclick }>
                        <div class={LI_DIV_CSS}>
                            <label><i class="icon-help flex-shrink-0 w-5"></i>{ Locale::current().help_and_support() }</label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                    <li onclick={ about_onclick } >
                        <div class={LI_DIV_CSS}>
                            <label><i class="icon-info flex-shrink-0 w-5"></i>{ Locale::current().about() }</label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                    <li onclick={ logout_onclick.clone() }>
                        <div class={LI_DIV_CSS}>
                            <label href="/login" for="toggle">
                                <i class="icon-logout flex-shrink-0 w-5"></i>
                                { Locale::current().logout() }
                            </label>
                        </div>
                    </li>
                </ul>
            </div>
        </BlankPage>
    }
}
