use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

use crate::{
    components::blank_page::{BlankPage, HeaderButtonProps},
    css::*,
    hooks::use_user_context,
    i18n::*,
    routes::AppRoute,
    services::get_build_info,
};

#[function_component(About)]
pub fn about() -> Html {
    let ctx = use_user_context();

    let build_info = use_async(async move { get_build_info().await });

    {
        let build_info = build_info.clone();
        use_mount(move || {
            build_info.run();
        });
    }

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
                <div class="text-center text-sm space-y-4">
                    <p>
                        <label>{format!("{} (Git hash)", build_info.data.clone().map(|info| info.git_hash).unwrap_or_default())}</label>
                    </p>
                    <p>
                        <label>{format!("{} (Build time)", build_info.data.clone().map(|info| info.build_time).unwrap_or_default())}</label>
                    </p>
                </div>
            </div>
        </BlankPage>
    }
}
