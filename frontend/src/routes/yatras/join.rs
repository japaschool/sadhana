use common::error::AppError;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::use_navigator;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    routes::AppRoute,
    services,
};

#[derive(Properties, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
}

#[function_component(JoinYatra)]
pub fn join_yatra(props: &Props) -> Html {
    let yatra = {
        let yatra_id = props.yatra_id.clone();
        use_async(async move { services::get_yatra(&yatra_id).await.map(|resp| resp.yatra) })
    };
    let nav = use_navigator().unwrap();

    let join = {
        let yatra_id = props.yatra_id.clone();
        let nav = nav.clone();
        use_async(async move {
            services::join_yatra(&yatra_id)
                .await
                .map(|_| nav.push(&AppRoute::Yatras))
        })
    };

    {
        let yatra = yatra.clone();
        use_mount(move || {
            yatra.run();
        });
    }

    let onsubmit = {
        let join = join.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default(); /* Prevent event propagation */
            join.run();
        })
    };

    let error_formatter = {
        Callback::from(move |err| match err {
            AppError::UnprocessableEntity(err)
                if err.iter().any(|s| s.ends_with("already exists.")) =>
            {
                Some(Locale::current().yatra_already_joined())
            }
            _ => None,
        })
    };

    html! {
        <BlankPage
            header_label={format!(
                    "{} {}",
                    Locale::current().yatra_join(),
                    yatra
                        .data
                        .iter()
                        .map(|y| y.name.clone())
                        .next()
                        .unwrap_or_default()
                )}
            loading={yatra.loading || join.loading}
        >
            <ListErrors error={yatra.error.clone()} />
            <ListErrors error={join.error.clone()} {error_formatter} />
            <div class={BODY_DIV_CSS}>
                <form {onsubmit}>
                    <div class="relative">
                        <button class={SUBMIT_BTN_CSS}>
                            <i class="icon-tick" />
                            { format!(" {}", Locale::current().yatra_join()) }
                        </button>
                    </div>
                </form>
            </div>
        </BlankPage>
    }
}
