use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
        pwd::Pwd,
    },
    css::*,
    i18n::Locale,
    routes::AppRoute,
    services,
};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;
use yew_router::prelude::use_navigator;

#[function_component(EditPassword)]
pub fn edit_password() -> Html {
    let new_password = use_state(String::new);
    let current_pwd = use_state(String::default);
    let nav = use_navigator().unwrap();

    let update_password = {
        let new_password = new_password.clone();
        let current_pwd = current_pwd.clone();
        let nav = nav.clone();
        use_async(async move {
            services::update_user_password(&current_pwd, &new_password)
                .await
                .map(|_| nav.push(&AppRoute::Settings))
        })
    };

    let pwd_onchange = {
        let new_password = new_password.clone();
        Callback::from(move |new_pwd: String| {
            new_password.set(new_pwd);
        })
    };

    let onsubmit = {
        let update_password = update_password.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            update_password.run();
        })
    };

    let oninput = {
        let pwd = current_pwd.clone();
        Callback::from(move |e: InputEvent| {
            let target: HtmlInputElement = e.target_unchecked_into();
            pwd.set(target.value());
        })
    };

    html! {
        <form {onsubmit} >
            <BlankPage
                header_label={ Locale::current().change_password() }
                left_button={HeaderButtonProps::back_to(AppRoute::Settings)}
                loading={ update_password.loading }
                >
                <ListErrors error={update_password.error.clone()} />
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <input
                            id="current_pwd"
                            type="password"
                            placeholder="Current Password"
                            class={ INPUT_CSS }
                            value={ (*current_pwd).clone() }
                            { oninput }
                            required=true
                            autocomplete="off"
                            minlength="5"
                            maxlength="256"
                            />
                        <label for="current_pwd"
                            class={ INPUT_LABEL_CSS }>
                            <i class="icon-key"></i>{ format!(" {}", Locale::current().current_password()) }
                        </label>
                    </div>
                    <Pwd
                        onchange={ pwd_onchange.clone() }
                        required=true
                        />
                    <div class="relative">
                        <button class={ SUBMIT_BTN_CSS }>
                        <i class="icon-login"></i>{ format!(" {}", Locale::current().save()) }</button>
                    </div>
                </div>
            </BlankPage>
        </form>
    }
}
