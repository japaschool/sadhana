use common::error::AppError;
use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub error: Option<AppError>,
}

#[function_component(ListErrors)]
pub fn list_errors(props: &Props) -> Html {
    if let Some(error) = &props.error {
        html! {
            <ul class="error-messages">
                {
                    match error {
                        AppError::UnprocessableEntity(error_info) => {
                            html! {
                                <>
                                {for error_info.iter().map(|e| {
                                    html! {
                                        <li>{e}</li>
                                    }
                                })}
                                </>
                            }
                        }
                        _ => {
                            html! {
                                <li>{error}</li>
                            }
                        }

                    }
                }
            </ul>
        }
    } else {
        html! {}
    }
}
