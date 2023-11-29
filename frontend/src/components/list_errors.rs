use std::fmt::Display;

use crate::{i18n::Locale, routes::AppRoute};
use common::error::AppError;
use yew::prelude::*;
use yew_router::prelude::{use_navigator, Navigator};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub error: Option<AppError>,
    pub error_formatter: Option<Callback<AppError, Option<String>>>,
}

fn p<S: Display>(text: S) -> Html {
    html! { <p class="text-gray dark:text-zinc-100 left-2">{ text }</p> }
}

fn default(error: &AppError, nav: Navigator) -> Html {
    match error {
        AppError::UnprocessableEntity(error_info) => error_info.iter().map(p).collect::<Html>(),
        AppError::RequestError => p(Locale::current().request_error()),
        AppError::InternalServerError => p(Locale::current().internal_server_error()),
        AppError::Unauthorized(_) => {
            nav.push(&AppRoute::Login);
            p(Locale::current().unauthorized())
        }
        _ => p(error),
    }
}

#[function_component(ListErrors)]
pub fn list_errors(props: &Props) -> Html {
    let nav = use_navigator().unwrap();

    if let Some(error) = &props.error {
        html! {
            <div class="relative rounded-md border py-2 px-2 bg-red-900 bg-opacity-30 border-red-900">
                {
                    match &props.error_formatter {
                        Some(f) => {
                            match f.emit(error.clone()) {
                                Some(msg) => p(msg),
                                None => default(error, nav)
                            } }
                        None => default(error, nav)
                    }
                }
            </div>
        }
    } else {
        html! {}
    }
}
