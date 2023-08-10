use yew::prelude::*;

use crate::{components::blank_page::BlankPage, css::*, i18n::*};

#[function_component(About)]
pub fn about() -> Html {
    html! {
        <BlankPage show_footer=true >
            <div class={ BODY_DIV_CSS }>
                <div class="text-center">
                    <h5 class="mb-4 text-xl font-medium leading-tight">{"Our mission is to make the world happier and healthier."}</h5>
                    <p class="text-zinc-500 dark:text-zinc-200">{"We're a small and mighty team passionate about..."}</p>
                    <p class="text-zinc-500 dark:text-zinc-200">{"Some other info"}</p>
                </div>
            </div>
        </BlankPage>
    }
}
