use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
    },
    css::*,
    hooks::use_user_context,
    i18n::*,
    model::*,
    routes::AppRoute,
    services,
};

#[function_component(EditUser)]
pub fn edit_user() -> Html {
    let user_info = use_state(UpdateUser::default);
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

    let edit_onclick = {
        let editing = editing.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            editing.toggle();
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

    let onreset = {
        let editing = editing.clone();
        let user_info = user_info.clone();
        let ctx = user_ctx.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            user_info.set(UpdateUser::new(&ctx.name));
            editing.toggle();
        })
    };

    let onsubmit = {
        let update_user = update_user.clone();
        let editing = editing.clone();
        let user_info = user_info.clone();
        let ctx = user_ctx.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            if !user_info.name.is_empty() && ctx.name != user_info.name {
                update_user.run();
            }
            editing.toggle();
        })
    };

    html! {
        <form {onsubmit} {onreset} >
            <BlankPage
                show_footer={ !*editing }
                selected_page={AppRoute::Settings}
                left_button={ if *editing { HeaderButtonProps::reset(Locale::current().cancel()) } else { HeaderButtonProps::back() }}
                right_button={ if *editing { HeaderButtonProps::submit(Locale::current().save()) } else { HeaderButtonProps::edit(edit_onclick) }}
                loading={ update_user.loading }
                header_label={ Locale::current().user_details() }
                >
                <ListErrors error={update_user.error.clone()} />
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
                </div>
            </BlankPage>
        </form>
    }
}
