use chrono::{Local, NaiveDate};
use common::error::AppError;
use gloo::storage::{LocalStorage, Storage};
use gloo_dialogs::prompt;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, calendar::Calendar, list_errors::ListErrors},
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
            create_yatra(yatra_name).await.map(|res| res.yatra)
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
        <div class="relative scroll-smooth hover:scroll-auto overflow-x-auto shadow-md border dark:border-zinc-200 border-zinc-400 rounded-lg">
            <div class="flex items-center justify-between pb-4">
                <table class="w-full text-sm text-left text-zinc-400 dark:text-zinc-200 table-auto bg-white dark:bg-zinc-700 bg-opacity-30 dark:bg-opacity-30">
                    <thead class="text-xs uppercase dark:bg-zinc-500 dark:text-zinc-200 text-zinc-400 bg-opacity-30 dark:bg-opacity-30">
                        <tr>
                            <th scope="col" class="px-6 py-3">{ Locale::current().sadhaka() }</th>
                            { data.data.iter().flat_map(|d| d.practices.iter()).map(|p| html! { <th scope="col" class="px-6 py-3">{ p.practice.clone() }</th> }).collect::<Html>() }
                        </tr>
                    </thead>
                    <tbody>
                        {
                            data
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
                                        html! { <td class="px-6 py-4">{ value_str }</td> }
                                    }).collect::<Html>();

                                    html! {
                                        <tr class="bg-white bg-opacity-40 dark:bg-opacity-40 dark:bg-zinc-800 dark:border-zinc-700 border-b hover:bg-zinc-50 dark:hover:bg-zinc-600">
                                            <th scope="row" class="flex items-center px-6 py-4 text-zinc-400 whitespace-nowrap dark:text-zinc-300">
                                                <div class="text-sm font-normal">{ user_name.clone() }</div>
                                            </th>
                                            { data_columns }
                                        </tr>
                                    }
                                })
                                .collect::<Html>()
                        }
                    </tbody>
                </table>
            </div>
        </div>
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
        <ListErrors error={yatras.error.clone()} />
        <ListErrors error={data.error.clone()} />
        <ListErrors error={new_yatra.error.clone()} />
        <div class={ BODY_DIV_CSS }>
            <Calendar selected_date={ *selected_date } date_onchange={ selected_date_onchange }/>
            <div class="relative">
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
