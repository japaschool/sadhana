use yew::prelude::*;

use crate::{
    components::blank_page::{BlankPage, HeaderButtonProps},
    css::*,
    hooks::use_user_context,
    i18n::*,
    routes::AppRoute,
};

#[function_component(About)]
pub fn about() -> Html {
    let ctx = use_user_context();

    html! {
        <BlankPage
            show_footer={ctx.is_authenticated()}
            selected_page={AppRoute::Settings}
            left_button={HeaderButtonProps::back()}
            >
            <div class={BODY_DIV_CSS}>
                <div class="text-justify space-y-4">
                    <h5 class="mb-4 text-xl font-medium leading-tight text-center">{Locale::current().about()}</h5>
                    {for Locale::current().about_text().lines().map(|l| html! {<p class="text-zinc-500 dark:text-zinc-200">{l}</p>})}
                </div>
            </div>
        </BlankPage>
    }
}
