use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
        pwd::Pwd,
    },
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    model::UpdateUser,
    services,
};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle};

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

    html! {
        <form {onsubmit} {onreset} >
            <BlankPage
                show_footer=true
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
                            <i class="fas fa-envelope icon"></i>{ format!(" {}", Locale::current().email_address()) }
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
                            <i class="fas fa-user icon"></i>{ format!(" {}", Locale::current().name()) }
                        </label>
                    </div>
                    <Pwd onchange={ pwd_onchange.clone() } readonly={ !*editing } required={ !user_password.is_empty() }/>
                    <div class="relative flex space-x-2.5 justify-center sm:text-base">
                        <a href="/login"
                            class={ LINK_CSS }
                            onclick={ onclick_logout.clone() }
                            >
                            { Locale::current().logout() }
                        </a>
                    // <hr class="h-px my-8 bg-gray-200 border-0 dark:bg-gray-700">
                    </div>
                    <div class="relative flex space-x-2.5 justify-center sm:text-base">
                    <label for="toggle"><i class="fas fa-moon icon"></i>{"Dark mode"}</label>
                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" name="toggle" id="toggle" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                    <label for="toggle" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                    </div>
</div>
                
            </BlankPage>
        </form>
    }
}
