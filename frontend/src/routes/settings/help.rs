use yew::prelude::*;
use yew_router::prelude::use_navigator;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        summary_details::SummaryDetails,
    },
    css::*,
    hooks::use_user_context,
    i18n::*,
    routes::AppRoute,
};

#[function_component(Help)]
pub fn help() -> Html {
    let nav = use_navigator().unwrap();
    let ctx = use_user_context();
    let send_msg_onclick = {
        let nav = nav.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::SupportForm);
        })
    };

    html! {
        <BlankPage
            show_footer={ctx.is_authenticated()}
            selected_page={AppRoute::Settings}
            left_button={HeaderButtonProps::back()}
            >
            <div class={ BODY_DIV_CSS }>
                <div class="text-center">
                    <h5 class="mb-4 text-xl font-medium leading-tight">{"FAQ"}</h5>
                    <SummaryDetails tab_index={1} label={"How to create a community"}>
                        <p class="pl-4 pr-4 pt-0 pb-2">{"Answer: "}<a href="https://stackoverflow.com">{"Under development"}</a></p>
                    </SummaryDetails>
                    if ctx.is_authenticated() {
                        <div class="pt-8">
                            <button onclick={send_msg_onclick} class={BTN_CSS_NO_MARGIN}>
                            <i class="icon-mail"></i>{Locale::current().sf_send_us_message()}</button>
                        </div>
                    }
                </div>
            </div>
        </BlankPage>
    }
}
