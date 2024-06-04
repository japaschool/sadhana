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

    let yt_links = [
        (
            Locale::current().help_registration(),
            "Hw1DQ3sRNAk?si=lpVPuUCQp8j-xJmC",
        ),
        (
            Locale::current().help_ios_web_app(),
            "KBViu8I4cJI?si=j-PwU1VGld1Yoa6z",
        ),
        (
            Locale::current().help_add_practice(),
            "cbQ5aVXvXiU?si=dPGawgCnPL8C1yzo",
        ),
        (
            Locale::current().help_rename_practice(),
            "jVfngYlbA68?si=xwMbf4WgtnGih5bj",
        ),
        (
            Locale::current().help_add_graph_report(),
            "gJ9jqB-nGtg?si=kNgEOfzfgWE99wco",
        ),
        (
            Locale::current().help_graph_show_avg(),
            "qqLOm_HZYWk?si=pOLdH4lBKoiYkjvY",
        ),
        (
            Locale::current().help_graph_add_practice(),
            "WY8LUyf_NaM?si=FxLay9PK9EDzXYlL",
        ),
        (
            Locale::current().help_graph_bar_chart_layouts(),
            "QbW1nANFX-w?si=fmBqDzuncfP0XlfU",
        ),
        (
            Locale::current().help_add_table_report(),
            "Bg8eAmoT-_I?si=RNpD3jYqs8RKxSjH",
        ),
    ];

    html! {
        <BlankPage
            show_footer={ctx.is_authenticated()}
            selected_page={AppRoute::Settings}
            left_button={HeaderButtonProps::back()}
            >
            <div class={BODY_DIV_SPACE_10_CSS}>
                <div class="text-center">
                    <h5 class="mb-4 text-xl font-medium leading-tight">{Locale::current().help_faq()}</h5>
                    {for yt_links.iter().map(|(title, link)| html!{
                        <SummaryDetails label={title.to_string()}>
                            <div class="aspect-video">
                                <iframe
                                    class="w-full h-full"
                                    src={format!("https://www.youtube.com/embed/{link}")}
                                    frameborder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerpolicy="strict-origin-when-cross-origin"
                                    allowfullscreen=true
                                    />
                            </div>
                        </SummaryDetails>
                    })}
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
