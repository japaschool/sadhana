use common::error::AppError;
use gloo::storage::{LocalStorage, Storage};
use gloo_dialogs::prompt;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{
        blank_page::{BlankPage, ButtonType, CalendarProps, HeaderButtonProps},
        grid::*,
        list_errors::ListErrors,
    },
    css::*,
    hooks::SessionStateContext,
    i18n::Locale,
    model::{PracticeDataType, Yatra, YatraData},
    routes::AppRoute,
    services::{create_yatra, get_user_yatras, get_yatra_data},
};

pub mod admin_settings;
pub mod join;
pub mod settings;

const SELECTED_YATRA_ID_KEY: &str = "selected_yatra";

#[function_component(Yatras)]
pub fn yatras() -> Html {
    let session_ctx = use_context::<SessionStateContext>().expect("No session state found");
    let nav = use_navigator().unwrap();
    let yatras = use_async(async move { get_user_yatras().await.map(|y| y.yatras) });
    let selected_yatra = use_state(|| None::<Yatra>);
    let data = {
        let session = session_ctx.clone();
        let selected_yatra = selected_yatra.clone();
        use_async(async move {
            if let Some(y) = selected_yatra.as_ref() {
                get_yatra_data(&y.id, &session.selected_date).await
            } else {
                Ok(YatraData::default())
            }
        })
    };
    let new_yatra = use_async(async move {
        if let Some(yatra_name) =
            prompt(&Locale::current().new_yatra_name(), None).filter(|s| !s.trim().is_empty())
        {
            create_yatra(yatra_name.trim().to_owned())
                .await
                .map(|res| res.yatra)
        } else {
            Err(AppError::UnprocessableEntity(vec![]))
        }
    });

    {
        let yatras = yatras.clone();
        use_mount(move || {
            yatras.run();
        });
    }

    {
        let nav = nav.clone();
        use_effect_with(new_yatra.clone(), move |res| {
            res.data
                .iter()
                .for_each(|y| nav.push(&AppRoute::YatraSettings { id: y.id.clone() }));
            || ()
        });
    }

    {
        let selected = selected_yatra.clone();
        use_effect_with(yatras.clone(), move |all| {
            let yatra = LocalStorage::get::<String>(SELECTED_YATRA_ID_KEY)
                .map(|s| s.replace('\"', ""))
                .ok()
                .and_then(|id| {
                    all.data
                        .iter()
                        .flat_map(|all| all.iter())
                        .find(|y| y.id == id)
                })
                .or(all.data.iter().flat_map(|all| all.iter()).next())
                .cloned();

            log::debug!(
                "Setting selected yatra to {:?}; all yatras: {:?}",
                yatra,
                all.data
            );

            selected.set(yatra);
            || ()
        });
    }

    {
        let data = data.clone();
        use_effect_with((selected_yatra.clone(), session_ctx.clone()), move |_| {
            data.run();
            || ()
        });
    }

    let yatra_onchange = {
        let selected = selected_yatra.clone();
        let yatras = yatras.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let yatra = yatras
                .data
                .iter()
                .flat_map(|inner| inner.iter())
                .find(|y| y.name == input.value())
                .cloned();

            yatra.iter().for_each(|y| {
                LocalStorage::set(SELECTED_YATRA_ID_KEY, y.id.clone()).unwrap();
            });

            selected.set(yatra);
        })
    };

    let create_yatra_onclick = {
        let create = new_yatra.clone();
        Callback::from(move |_: MouseEvent| {
            create.run();
        })
    };

    let grid = html! {
        <Grid>
            <Ghead>
                <Gh>{ Locale::current().sadhaka() }</Gh>
                { data
                    .data
                    .iter()
                    .flat_map(|d| d.practices.iter())
                    .map(|p| html! { <Gh>{ p.practice.clone() }</Gh> })
                    .collect::<Html>()
                }
            </Ghead>
            <Gbody>
            { data
                .data
                .iter()
                .flat_map(|d| d.data.iter())
                .map(|(user_name, values)| {
                    let data_columns = data.data
                        .iter()
                        .flat_map(|inner| inner.practices.iter())
                        .zip(values.iter())
                        .map(|(practice, value_opt)| {
                            let value_str = match practice.data_type {
                            PracticeDataType::Bool => value_opt
                                .as_ref()
                                .and_then(|b| b.as_bool())
                                .map(|b| if b { "V".to_string() } else { String::new() })
                                .unwrap_or_default(),
                            PracticeDataType::Int => value_opt
                                .as_ref()
                                .and_then(|v| v.as_int())
                                .map(|i| i.to_string())
                                .unwrap_or_default(),
                            PracticeDataType::Time => value_opt
                                .as_ref()
                                .and_then(|v| v.as_time_str())
                                .unwrap_or_default(),
                            PracticeDataType::Text => value_opt
                                .as_ref()
                                .and_then(|v| v.as_text())
                                .unwrap_or_default(),
                            PracticeDataType::Duration => value_opt
                                .as_ref()
                                .and_then(|v| v.as_duration_str())
                                .unwrap_or_default(),
                        };
                        html! { <Gd>{ value_str }</Gd> }
                    }).collect::<Html>();

                    html! {
                        <Gr>
                            <Ghd>{ user_name.clone() }</Ghd>
                            { data_columns }
                        </Gr>
                    }
                })
                .collect::<Html>()
            }
            </Gbody>
        </Grid>
    };

    let empty_body = html! {
        <div class={BODY_DIV_CSS}>
            <ListErrors error={yatras.error.clone()} />
            <span>{ Locale::current().no_yatras_msg() }</span>
            <div class="relative">
                <div class={ LINKS_CSS }>
                    <a class={ LINK_CSS } onclick={ create_yatra_onclick.clone() }>{ Locale::current().create_yatra() }</a>
                </div>
            </div>
        </div>
    };

    let grid_body = html! {
        <>
        <ListErrors error={yatras.error.clone()} />
        <ListErrors error={data.error.clone()} />
        <ListErrors error={new_yatra.error.clone()} />
        <div class={BODY_DIV_CSS}>
            <div class="relative pb-5">
                <select
                    class={ INPUT_CSS }
                    id="yatra"
                    onchange={ yatra_onchange }
                    required=true
                    >
                    {
                        yatras.data
                            .iter()
                            .flat_map(|inner| inner.iter())
                            .map(|y| {
                                let selected = selected_yatra.iter().any(|y2| y2 == y);
                                html! { <option class="text-black" { selected } >{ y.name.clone() }</option> }
                            })
                            .collect::<Html>()
                    }
                </select>
                <label for="yatra" class={ INPUT_LABEL_CSS }>
                    <i class="icon-user-group"></i>
                    { format!(" {}: ", Locale::current().yatra()) }
                </label>
            </div>
        </div>
        { grid }
        </>
    };

    html! {
        <BlankPage
            show_footer=true
            selected_page={AppRoute::Yatras}
            loading={ yatras.loading || data.loading }
            left_button={ HeaderButtonProps::blank() }
            right_button={
                if let Some(yatra) = selected_yatra.as_ref() {
                    HeaderButtonProps::new_redirect(Locale::current().settings(), AppRoute::YatraSettings { id: yatra.id.clone() }, None, ButtonType::Button)
                } else {
                    HeaderButtonProps::blank()
                }
            }
            calendar={CalendarProps::no_highlights()}
            >
            {
                if !yatras.loading
                    && yatras
                        .data
                        .iter()
                        .flat_map(|inner| inner.iter())
                        .next()
                        .is_none()
                {
                    empty_body
                } else {
                    grid_body
                }
            }
        </BlankPage>
    }
}
