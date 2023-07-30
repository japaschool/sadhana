use crate::{
    components::blank_page::BlankPage, css::*, hooks::use_user_context, i18n::Locale,
    routes::AppRoute,
};
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_router::prelude::use_navigator;

pub mod about;
pub mod edit_password;
pub mod edit_user;
pub mod help;
pub mod language;

#[function_component(Settings)]
pub fn settings() -> Html {
    let user_ctx = use_user_context();
    let nav = use_navigator().unwrap();

    let onclick_logout = {
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
            nav.push(&AppRoute::Help);
        })
    };
    let about_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::About);
        })
    };

    html! {
        <BlankPage show_footer=true >
            <div class="w-full text-center relative mt-3">
                <div class="absolute flex w-full h-full flex-col justify-center px-4">
                    <h5 class="mb-1 text-xl font-medium text-zinc-500 dark:text-zinc-100">{ user_ctx.name.clone() }</h5>
                    // <span class="text-sm text-zinc-300 dark:text-zinc-200">{"Bla-bla"}</span>
                </div>
            </div>
            <div class={ BODY_SETTINGS_CSS }>
                <ul onclick={ edit_user_onclick } class="pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500">
                    <li>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label>
                                <i class="icon-user flex-shrink-0 w-5"></i>
                                { "User details" }
                            </label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                </ul>
                <ul onclick={ edit_password_onclick } class="pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500">
                    <li>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label>
                                <i class="icon-edit flex-shrink-0 w-5"></i>
                                { "Change password" }
                            </label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                </ul>
                <ul onclick={ language_onclick } class="pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500">
                    <li>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label for="language">
                                <i class="icon-lang flex-shrink-0 w-5"></i>
                                { format!(" {} ", Locale::current().language()) }
                            </label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                </ul>
                <ul class="pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500">
                    <li>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
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
                <ul class="pt-4 mt-1 space-y-4 font-medium border-t border-gray-200 dark:border-zinc-500">
                    <li onclick={ help_onclick }>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label><i class="icon-help flex-shrink-0 w-5"></i>{"Help and support"}</label>
                        </div>
                    </li>
                    <li onclick={ about_onclick } >
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label><i class="icon-info flex-shrink-0 w-5"></i>{"About"}</label>
                            <i class="icon-chevron-right"></i>
                        </div>
                    </li>
                    <li onclick={ onclick_logout.clone() }>
                        <div class="relative flex justify-between items-center sm:text-base align-baseline">
                            <label href="/login" for="toggle"><i class="icon-logout flex-shrink-0 w-5"></i>{ Locale::current().logout() }</label>
                        </div>
                    </li>
                </ul>
            </div>
        </BlankPage>
    }
}
