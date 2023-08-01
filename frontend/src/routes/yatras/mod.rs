use chrono::{Local, NaiveDate};
use common::error::AppError;
use gloo::storage::{LocalStorage, Storage};
use gloo_dialogs::prompt;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, calendar::Calendar, grid::*, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, Yatra, YatraData},
    routes::AppRoute,
    services::{create_yatra, get_user_yatras, get_yatra_data},
};

pub mod admin_settings;
pub mod join;
pub mod settings;

const SELECTED_YATRA_ID_KEY: &'static str = "selected_yatra";

#[function_component(Yatras)]
pub fn yatras() -> Html {
    let nav = use_navigator().unwrap();
    let yatras = use_async(async move { get_user_yatras().await.map(|y| y.yatras) });
    let selected_yatra = use_state(|| None::<Yatra>);
    let selected_date = use_state(|| Local::now().date_naive());
    let data = {
        let selected_date = selected_date.clone();
        let selected_yatra = selected_yatra.clone();
        use_async(async move {
            if let Some(y) = selected_yatra.as_ref() {
                get_yatra_data(&y.id, &*selected_date).await
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
        use_effect_with_deps(
            move |res| {
                res.data
                    .iter()
                    .for_each(|y| nav.push(&AppRoute::YatraSettings { id: y.id.clone() }));
                || ()
            },
            new_yatra.clone(),
        );
    }

    {
        let selected = selected_yatra.clone();
        use_effect_with_deps(
            move |all| {
                let yatra = LocalStorage::get::<String>(SELECTED_YATRA_ID_KEY)
                    .map(|s| s.replace("\"", ""))
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
            },
            yatras.clone(),
        );
    }

    {
        let data = data.clone();
        use_effect_with_deps(
            move |_| {
                data.run();
                || ()
            },
            (selected_yatra.clone(), selected_date.clone()),
        );
    }

    let selected_date_onchange = {
        let selected = selected_date.clone();
        Callback::from(move |new_date: NaiveDate| {
            selected.set(new_date);
        })
    };

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
        <div>
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
        <Calendar selected_date={ *selected_date } date_onchange={ selected_date_onchange }/>
        <ListErrors error={yatras.error.clone()} />
        <ListErrors error={data.error.clone()} />
        <ListErrors error={new_yatra.error.clone()} />
        <div class={ format!("space-y-5 {}", BODY_DIV_BASE_CSS) }>
            <div class="flex space-x-3">
            <button class={ BTN_CSS }>
              <i class="icon-edit"></i><Link<AppRoute>
              to={
                  let id = selected_yatra.as_ref().map(|y| y.id.clone()).unwrap_or_default();
                  AppRoute::YatraSettings { id }}>{ Locale::current().modify_yatra() }
                  </Link<AppRoute>>
            </button>
            <button class={ BTN_CSS } onclick={ create_yatra_onclick.clone() }>
              <i class="icon-plus"></i>{ Locale::current().create_yatra() }
            </button>
        </div>
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
            { grid }
        </div>
        </>
    };

    html! {
        <BlankPage show_footer=true loading={ yatras.loading || data.loading }>
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
