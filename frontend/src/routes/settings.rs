use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
        pwd::Pwd,
    },
    css::*,
    hooks::use_user_context,
    i18n::{Locale, DEFAULT_LANGUAGE_KEY, USER_LANGUAGE_STORAGE_KEY},
    model::UpdateUser,
    services,
};
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle};

static LANGUAGE_DATA: [(&'static str, &'static str); 3] =
    [("en", "English"), ("ru", "Русский"), ("ua", "Українська")];

#[function_component(Settings)]
pub fn settings() -> Html {
    let user_info = use_state(|| UpdateUser::default());
    let user_password = use_state(|| String::new());
    let editing = use_bool_toggle(false);
    let user_ctx = use_user_context();

    {
        let user_info = user_info.clone();
        use_effect_with_deps(
            move |ctx| {
                user_info.set(UpdateUser::new(&ctx.name));
                || ()
            },
            user_ctx.clone(),
        );
    }

    let update_user = {
        let user_info = user_info.clone();
        use_async(async move { services::update_user((*user_info).clone()).await })
    };

    let update_password = {
        let user_password = user_password.clone();
        use_async(async move { services::update_user_password((*user_password).clone()).await })
    };

    let edit_onclick = {
        let editing = editing.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            editing.toggle();
        })
    };

    let onclick_logout = {
        let user_ctx = user_ctx.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            user_ctx.logout();
        })
    };

    let name_oninput = {
        let user_info = user_info.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_info = (*user_info).clone();
            new_info.name = input.value();
            user_info.set(new_info);
        })
    };

    let pwd_onchange = {
        let user_password = user_password.clone();
        Callback::from(move |new_pwd: String| {
            user_password.set(new_pwd);
        })
    };

    let onreset = {
        let editing = editing.clone();
        let user_info = user_info.clone();
        let user_password = user_password.clone();
        let ctx = user_ctx.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            user_info.set(UpdateUser::new(&ctx.name));
            user_password.set(String::new());
            editing.toggle();
        })
    };

    let onsubmit = {
        let update_user = update_user.clone();
        let update_password = update_password.clone();
        let editing = editing.clone();
        let user_info = user_info.clone();
        let user_password = user_password.clone();
        let ctx = user_ctx.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            if !user_info.name.is_empty() && ctx.name != user_info.name {
                update_user.run();
            }
            if !user_password.is_empty() {
                update_password.run();
            }
            editing.toggle();
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
        <form {onsubmit} {onreset} >
            <BlankPage
                show_footer={ !*editing }
                left_button={ if *editing { HeaderButtonProps::reset(Locale::current().cancel()) } else { HeaderButtonProps::blank() }}
                right_button={ if *editing { HeaderButtonProps::submit(Locale::current().save()) } else { HeaderButtonProps::edit(edit_onclick) }}
                loading={ update_user.loading || update_password.loading }
                >
                <ListErrors error={update_user.error.clone()} />
                <ListErrors error={update_password.error.clone()} />
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            id="email"
                            type="email"
                            placeholder="Email"
                            class={ INPUT_CSS }
                            value={ user_ctx.email.clone() }
                            disabled=true
                            required=true
                            />
                        <label for="email"
                            class={ INPUT_LABEL_CSS }>
                            <i class="icon-mail"></i>{ format!(" {}", Locale::current().email_address()) }
                        </label>
                    </div>
                    <div class="relative">
                        <input
                            id="name"
                            type="text"
                            placeholder="Name"
                            class={ INPUT_CSS }
                            value={ user_info.name.clone() }
                            oninput={ name_oninput.clone() }
                            readonly={ !*editing }
                            minlength="3"
                            />
                        <label for="name"
                            class={ INPUT_LABEL_CSS }>
                            <i class="icon-user"></i>{ format!(" {}", Locale::current().name()) }
                        </label>
                    </div>
                    <Pwd onchange={ pwd_onchange.clone() } readonly={ !*editing } required={ !user_password.is_empty() }/>
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
                    <div class="relative flex space-x-2.5 justify-center sm:text-base">
                        <a href="/login"
                            class={ LINK_CSS }
                            onclick={ onclick_logout.clone() }
                            >
                            { Locale::current().logout() }
                        </a>
                    </div>
                    <div class="relative flex space-x-2.5 justify-center sm:text-base">
                        <label for="toggle"><i class="icon-moon"></i>{ Locale::current().dark_mode() }</label>
                        <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
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
                </div>
            </BlankPage>
        </form>
    }
}
