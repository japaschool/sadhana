use chrono::{Local, NaiveDate};
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

use crate::{
    components::{blank_page::BlankPage, calendar::Calendar, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, Yatra, YatraData},
    services::{get_user_yatras, get_yatra_data},
};

const SELECTED_YATRA_ID_KEY: &'static str = "selected_yatra";

#[function_component(Yatras)]
pub fn yatras() -> Html {
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

    {
        let yatras = yatras.clone();
        use_mount(move || {
            yatras.run();
        });
    }

    {
        let selected = selected_yatra.clone();
        use_effect_with_deps(
            move |all| {
                let mut it = all.data.iter().flat_map(|all| all.iter());
                let yatra = LocalStorage::get::<String>(SELECTED_YATRA_ID_KEY)
                    .map(|s| s.replace("\"", ""))
                    .ok()
                    .and_then(|id| it.find(|y| y.id == id))
                    .or(it.next())
                    .cloned();
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

    let grid = html! {
        <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
            <div class="flex items-center justify-between pb-4 bg-white bg-opacity-50 dark:bg-gray-900">
                <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400 table-auto">
                    <thead class="text-xs uppercase bg-gray-50 bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 dark:text-gray-400">
                        <tr>
                            <th scope="col" class="px-6 py-3">{"Sadhaka"}</th>
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
                                        <tr class="bg-white bg-opacity-50 border-b dark:bg-gray-800 dark:bg-opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                            <th scope="row" class="flex items-center px-6 py-4 text-gray-400 whitespace-nowrap dark:text-gray-300">
                                                <div class="text-sm font-semibold">{ user_name.clone() }</div>
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
            <span>{
                "You don't seem to be part of any yatra. Please create a new one or ask someone to invite you into an existing one."
            }</span>
        </div>
    };

    let grid_body = html! {
        <>
        <Calendar selected_date={ *selected_date } date_onchange={ selected_date_onchange }/>
        <ListErrors error={yatras.error.clone()} />
        <ListErrors error={data.error.clone()} />
        <div class={ BODY_DIV_CSS }>
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
        </div>
        </>
    };

    html! {
        <BlankPage show_footer=true loading={ yatras.loading || data.loading }>
            {
                if !yatras.loading && yatras.data.iter().flat_map(|inner| inner.iter()).next().is_none() { empty_body } else { grid_body }
            }
        </BlankPage>
    }
}
