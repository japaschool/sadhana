use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::list_errors::ListErrors,
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

    if signup_confirmation.loading {
        return html! {
            <div><label>{ "Loading..." }</label></div>
        };
    }

    html! {
        <div class="auth-page">
            <div class="container page">
                <div class="row">
                    <div class="col-md-6 offset-md-3 col-xs-12">
                        <h1 class="text-xs-center">{ "Sign Up" }</h1>
                        <p class="text-xs-center">
                            <Link<AppRoute> to={AppRoute::Login}>
                                { Locale::current().have_an_account() }
                            </Link<AppRoute>>
                        </p>
                        <ListErrors error={user_register.error.clone()} />
                        <ListErrors error={signup_confirmation.error.clone()} />
                        <form {onsubmit}>
                            <fieldset>
                                <fieldset class="form-group">
                                    <input
                                        class="form-control form-control-lg"
                                        type="text"
                                        placeholder={ Locale::current().name() }
                                        value={ register_info.name.clone() }
                                        oninput={ oninput_name }
                                        required = true
                                        />
                                </fieldset>
                                <fieldset class="form-group">
                                    <input
                                        class="form-control form-control-lg"
                                        type="email"
                                        placeholder="Email"
                                        value={ register_info.email.clone() }
                                        disabled=true
                                        required = true
                                        />
                                </fieldset>
                                <fieldset class="form-group">
                                    <input
                                        class="form-control form-control-lg"
                                        type="password"
                                        placeholder={ Locale::current().password() }
                                        value={ register_info.password.clone() }
                                        oninput={ oninput_password }
                                        required = true
                                        />
                                </fieldset>
                                <button
                                    class="btn btn-lg btn-primary pull-xs-right"
                                    type="submit"
                                    disabled=false
                                    >
                                    { Locale::current().sign_up() }
                                </button>
                            </fieldset>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    }
}
