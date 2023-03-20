use common::error::AppError;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    model::{RegisterInfo, RegisterInfoWrapper},
    routes::AppRoute,
    services,
};

#[derive(Properties, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub id: AttrValue,
}

#[function_component(RegisterWithId)]
pub fn register_with_id(props: &Props) -> Html {
    let user_ctx = use_user_context();
    let register_info = use_state(RegisterInfo::default);
    let user_register = {
        let register_info = register_info.clone();
        use_async(async move {
            let request = RegisterInfoWrapper {
                user: (*register_info).clone(),
            };
            services::register(request).await
        })
    };

    let signup_confirmation = {
        let id = props.id.clone();
        use_async(async move {
            services::get_signup_link_details(id.as_str())
                .await
                .map(|wrapper| wrapper.confirmation)
        })
    };

    {
        //FIXME: remove this?
        // Load confirmation from the backend
        let signup_confirmation = signup_confirmation.clone();
        use_mount(move || signup_confirmation.run());
    }

    {
        let register_info = register_info.clone();
        use_effect_with_deps(
            move |confirmation| {
                let mut info = (*register_info).clone();
                confirmation.data.iter().for_each(|c| {
                    info.email = c.email.clone();
                    info.confirmation_id = c.id.clone();
                });
                register_info.set(info);
                || ()
            },
            signup_confirmation.clone(),
        );
    }

    // Hook into changes of user_register. Once a user is successfully registered, log him in
    use_effect_with_deps(
        move |user_register| {
            if let Some(user_info) = &user_register.data {
                user_ctx.login(user_info.user.clone());
            }
            || ()
        },
        user_register.clone(),
    );

    let onsubmit = {
        let user_register = user_register.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default(); /* Prevent event propagation */
            user_register.run();
        })
    };
    let oninput_name = {
        let register_info = register_info.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut info = (*register_info).clone();
            info.name = input.value();
            register_info.set(info);
        })
    };
    let oninput_password = {
        let register_info = register_info.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut info = (*register_info).clone();
            info.password = input.value();
            register_info.set(info);
        })
    };

    let error_formatter = {
        Callback::from(move |err| match err {
            AppError::NotFound => Some(Locale::current().invalid_signup_link()),
            _ => None,
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().register() } loading={ user_register.loading }>
            <ListErrors error={signup_confirmation.error.clone()} error_formatter={ error_formatter.clone() } />
            <ListErrors error={user_register.error.clone()} error_formatter={ error_formatter.clone() } />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                            <input
                                id="email"
                                type="email"
                                placeholder="Email"
                                class={ INPUT_CSS }
                                value={ register_info.email.clone() }
                                disabled=true
                                required = true
                                />
                            <label for="email"
                                class={ INPUT_LABEL_CSS }>
                                <i class="fa fa-envelope"></i>{ format!(" {}", Locale::current().email_address()) }
                            </label>
                        </div>
                        <div class="relative">
                            <input
                                id="name"
                                type="text"
                                placeholder="Name"
                                class={ INPUT_CSS }
                                value={ register_info.name.clone() }
                                oninput={ oninput_name }
                                required = true
                                minlength="3"
                                />
                            <label for="name"
                                class={ INPUT_LABEL_CSS }>
                                <i class="fa fa-user"></i>{ format!(" {}", Locale::current().name()) }
                            </label>
                        </div>
                        <div class="relative">
                            <input
                                id="password"
                                type="password"
                                placeholder="Password"
                                class={ INPUT_CSS }
                                value={ register_info.password.clone() }
                                oninput={ oninput_password }
                                required = true
                                minlength="5"
                                />
                            <label for="password"
                                class={ INPUT_LABEL_CSS }>
                                <i class="fa fa-key"></i>{ format!(" {}", Locale::current().password()) }
                            </label>
                        </div>
                        <div class="relative flex justify-between sm:text-sm">
                            <Link<AppRoute>
                                classes={ LINK_CSS }
                                to={AppRoute::Login}>{ Locale::current().have_an_account() }
                            </Link<AppRoute>>
                        </div>
                        <div class="relative">
                            <button class={ SUBMIT_BTN_CSS }>{ Locale::current().sign_up() }</button>
                        </div>
                </div>
            </form>
        </BlankPage>
    }
}
