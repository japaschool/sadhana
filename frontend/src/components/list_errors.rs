use std::fmt::Display;

use common::error::AppError;
use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub error: Option<AppError>,
}

fn p<S: Display>(text: S) -> Html {
    html! { <p class="text-white left-2">{ text }</p> }
}
// TODO: Error messages localization
// TODO: Error messages should be customizable. Ie Not Found on Login screen should have different message to Not found in other places
#[function_component(ListErrors)]
pub fn list_errors(props: &Props) -> Html {
    if let Some(error) = &props.error {
        html! {
            <div class="relative rounded-sm border py-2 px-2 bg-red-900 bg-opacity-30 border-red-900">
                {
                    match error {
                        AppError::UnprocessableEntity(error_info) => error_info.iter().map(|e| { p(e) }).collect::<Html>(),
                        _ => p(error),
                    }
                }
            </div>
        }
    } else {
        html! {}
    }
}
