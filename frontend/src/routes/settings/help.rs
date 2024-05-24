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
            <div class={BODY_DIV_SPACE_10_CSS}>
                <div class="text-center">
                    <h5 class="mb-4 text-xl font-medium leading-tight">{Locale::current().help_faq()}</h5>
                    <SummaryDetails label={Locale::current().help_registration()}>
                        <div class="aspect-video">
                            <iframe
                                class="w-full h-full"
                                src="https://www.youtube.com/embed/Hw1DQ3sRNAk?si=lpVPuUCQp8j-xJmC"
                                title="YouTube video player"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerpolicy="strict-origin-when-cross-origin"
                                allowfullscreen=true
                                />
                        </div>
                    </SummaryDetails>
                    <SummaryDetails label={Locale::current().help_add_practice()}>
                        <div class="aspect-video">
                            <iframe
                                class="w-full h-full"
                                src="https://www.youtube.com/embed/cbQ5aVXvXiU?si=dPGawgCnPL8C1yzo"
                                title="YouTube video player"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerpolicy="strict-origin-when-cross-origin"
                                allowfullscreen=true
                                />
                        </div>
                    </SummaryDetails>
                    <SummaryDetails label={Locale::current().help_rename_practice()}>
                        <div class="aspect-video">
                            <iframe
                                class="w-full h-full"
                                src="https://www.youtube.com/embed/jVfngYlbA68?si=xwMbf4WgtnGih5bj"
                                title="YouTube video player"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerpolicy="strict-origin-when-cross-origin"
                                allowfullscreen=true
                                />
                        </div>
                    </SummaryDetails>
                </div>
            </div>
            if ctx.is_authenticated() {
                <div class={BODY_DIV_NO_PADDING_CSS}>
                    <div class="pt-8">
                        <button onclick={send_msg_onclick} class={BTN_CSS_NO_MARGIN}>
                        <i class="icon-mail"></i>{Locale::current().sf_send_us_message()}</button>
                    </div>
                </div>
            }
        </BlankPage>
    }
}
