use std::{error::Error, str::FromStr};

use crate::{
    components::{
        blank_page::BlankPage, chart::Chart, clipboard_copy_button::CopyButton, grid::*,
        list_errors::ListErrors,
    },
    css::*,
    hooks::use_user_context,
    i18n::Locale,
    model::{PracticeDataType, PracticeEntryValue, ReportData, ReportDataEntry, UserPractice},
    services::{
        get_chart_data, get_shared_chart_data, get_shared_practices, get_user_practices, user_info,
    },
};
use chrono::Local;
use common::ReportDuration;
use csv::Writer;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::spawn_local;
use web_sys::{BlobPropertyBag, HtmlElement, HtmlInputElement};
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

#[function_component(Charts)]
pub fn charts() -> Html {
    let today = Local::now().date_naive();
    let user_ctx = use_user_context();
    let selected_practice = use_state(|| None as Option<UserPractice>);
    let duration = use_state(|| ReportDuration::Last7Days);

    let all_practices = use_async(async move {
        get_user_practices().await.map(|res| {
            res.user_practices
                .into_iter()
                .filter(|p| p.is_active)
                .collect::<Vec<_>>()
        })
    });

    let report_data = {
        let practice = selected_practice.clone();
        let duration = duration.clone();
        use_async(async move {
            match &*practice {
                Some(p) => get_chart_data(&today, &Some(p.practice.clone()), &*duration)
                    .await
                    .map(|res| res.values),
                None => Ok(vec![]),
            }
        })
    };

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        use_mount(move || {
            all_practices.run();
        });
    }

    let pull_data = {
        let report_data = report_data.clone();
        let duration = duration.clone();
        let selected_practice = selected_practice.clone();
        Callback::from(move |(practice, dur)| {
            duration.set(dur);
            selected_practice.set(Some(practice));
            report_data.run();
        })
    };

    fn to_csv_str(data: ReportData) -> Result<String, Box<dyn Error>> {
        let mut wrt = Writer::from_writer(vec![]);
        let mut practices = vec![Locale::current().date()];
        let mut practices_done = false;
        let mut cob = None;
        let mut row = vec![];
        for entry in data.values {
            let entry_str = entry.value.map(|v| v.to_string()).unwrap_or_default();
            if cob.is_none() {
                row.push(entry.cob_date.to_string());
                row.push(entry_str);
                cob = Some(entry.cob_date);
                practices.push(entry.practice);
            } else if cob == Some(entry.cob_date) {
                row.push(entry_str);
                if !practices_done {
                    practices.push(entry.practice);
                }
            } else {
                if !practices_done {
                    practices_done = true;
                    wrt.write_record(practices)?;
                    practices = vec![];
                }
                cob = Some(entry.cob_date);
                wrt.write_record(row)?;
                row = vec![entry.cob_date.to_string(), entry_str];
            }
        }
        let res = String::from_utf8(wrt.into_inner()?)?;
        Ok(res)
    }

    let download_onclick = {
        let duration = duration.clone();
        Callback::from(move |_: MouseEvent| {
            let duration = duration.clone();
            spawn_local(async move {
                get_chart_data(&today, &None, &*duration)
                    .await
                    .map(|data| {
                        let csv = to_csv_str(data).unwrap_or_default();
                        let json_jsvalue_array =
                            js_sys::Array::from_iter(std::iter::once(JsValue::from_str(&csv)));
                        let b = web_sys::Blob::new_with_str_sequence_and_options(
                            &json_jsvalue_array,
                            &BlobPropertyBag::new().type_("text/csv"),
                        )
                        .unwrap();
                        let url = web_sys::Url::create_object_url_with_blob(&b).unwrap();
                        let a = web_sys::window()
                            .unwrap()
                            .document()
                            .unwrap()
                            .create_element("a")
                            .unwrap()
                            .dyn_into::<HtmlElement>()
                            .unwrap();

                        a.set_attribute("href", &url).unwrap();

                        a.click();
                    })
                    .unwrap();
            });
        })
    };

    html! {
        <BlankPage show_footer=true loading={all_practices.data.is_none()} header_label={user_ctx.name.clone()}>
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={report_data.error.clone()} />
            if all_practices.data.is_some(){
                <ChartsBase
                    practices={all_practices.data.clone().unwrap_or_default()}
                    report_data={report_data.data.clone().unwrap_or_default()}
                    {pull_data}
                    />
            }
            <div class={TWO_COLS_NO_GAP_CSS}>
                <CopyButton
                    button_label={Locale::current().share_charts_link()}
                    relative_link={format!("/shared/{}", user_ctx.id)}
                    />
                <div class="relative">
                    <button onclick={download_onclick} class={BTN_CSS}>
                    <i class="icon-???"></i>{Locale::current().download_csv()}</button>
                </div>
            </div>
        </BlankPage>
    }
}

#[derive(Properties, Clone, PartialEq)]
pub struct SharedChartsProps {
    pub share_id: AttrValue,
}

#[function_component(SharedCharts)]
pub fn shared_charts(props: &SharedChartsProps) -> Html {
    let user_info = {
        let share_id = props.share_id.clone();
        use_async(async move { user_info(&share_id).await.map(|inner| inner.user) })
    };

    let all_practices = {
        let share_id = props.share_id.clone();
        use_async(async move {
            get_shared_practices(&share_id).await.map(|res| {
                res.user_practices
                    .into_iter()
                    .filter(|p| p.is_active)
                    .collect::<Vec<_>>()
            })
        })
    };

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        let user_info = user_info.clone();
        use_mount(move || {
            all_practices.run();
            user_info.run();
        });
    }

    let selected_practice = use_state(|| None as Option<UserPractice>);
    let duration = use_state(|| ReportDuration::Last30Days);

    let report_data = {
        let practice = selected_practice.clone();
        let duration = duration.clone();
        let share_id = props.share_id.clone();
        use_async(async move {
            match &*practice {
                Some(p) => get_shared_chart_data(&share_id, &p.practice, &*duration)
                    .await
                    .map(|res| res.values),
                None => Ok(vec![]),
            }
        })
    };

    let pull_data = {
        let report_data = report_data.clone();
        let duration = duration.clone();
        let selected_practice = selected_practice.clone();
        Callback::from(move |(practice, dur)| {
            duration.set(dur);
            selected_practice.set(Some(practice));
            report_data.run();
        })
    };

    html! {
            <BlankPage
                show_footer=false
                loading={all_practices.loading || user_info.loading}
                header_label={user_info.data.as_ref().map(|u| u.name.to_owned()).unwrap_or_default()}
                >
                <ListErrors error={all_practices.error.clone()} />
                <ListErrors error={report_data.error.clone()} />
                if all_practices.data.is_some(){
                    <ChartsBase
                        practices={all_practices.data.clone().unwrap_or_default()}
                        report_data={report_data.data.clone().unwrap_or_default()}
                        {pull_data}/>
            }
            </BlankPage>
    }
}

#[derive(Properties, Clone, PartialEq)]
pub struct ChartBaseProps {
    #[prop_or_default]
    pub practices: Vec<UserPractice>,
    #[prop_or_default]
    pub report_data: Vec<ReportDataEntry>,
    pub pull_data: Callback<(UserPractice, ReportDuration), ()>,
}

const DATE_FORMAT: &'static str = "%Y-%m-%d";
const DATE_FORMAT_HR: &'static str = "%a, %d %b";

#[function_component(ChartsBase)]
fn charts_base(props: &ChartBaseProps) -> Html {
    let selected_practice = use_state(|| props.practices.first().cloned());
    let duration = use_state(|| ReportDuration::Last7Days);

    let duration_onchange = {
        let dur = duration.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            if let Ok(d) = ReportDuration::from_str(&input.value()) {
                dur.set(d.clone());
            };
        })
    };

    {
        let pull_data = props.pull_data.clone();
        use_effect_with_deps(
            move |(p, d)| {
                if let Some(p) = &**p {
                    pull_data.emit((p.to_owned(), (**d).clone()));
                }
                || ()
            },
            (selected_practice.clone(), duration.clone()),
        );
    }

    let practice_onchange = {
        let all_practices = props.practices.clone();
        let selected_practice = selected_practice.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            selected_practice.set(
                all_practices
                    .iter()
                    .find(|p| p.practice == input.value())
                    .cloned(),
            );
        })
    };

    let (x_values, y_values): (Vec<_>, Vec<_>) = selected_practice
        .iter()
        .flat_map(|selected| {
            props.report_data.iter().map(|p| {
                (
                    p.cob_date.format(DATE_FORMAT).to_string(),
                    match selected.data_type {
                        PracticeDataType::Int => p
                            .value
                            .as_ref()
                            .and_then(|v| v.as_int())
                            .unwrap_or_default()
                            .to_string(),
                        PracticeDataType::Time => p
                            .value
                            .as_ref()
                            .and_then(|v| v.as_time_str())
                            .map(|s| format!("2020-01-01 {}:00", s))
                            .unwrap_or_default(),
                        PracticeDataType::Duration => p
                            .value
                            .as_ref()
                            .and_then(|v| match v {
                                PracticeEntryValue::Duration(minutes) => Some(minutes.to_string()),
                                _ => None,
                            })
                            .unwrap_or_default(),
                        PracticeDataType::Text | PracticeDataType::Bool => p
                            .value
                            .as_ref()
                            .map(|_| "1".to_string())
                            .unwrap_or_default(),
                    },
                )
            })
        })
        .unzip();

    let avg_value = selected_practice
        .iter()
        .flat_map(|selected| {
            let report_data = props
                .report_data
                .split_last()
                .map(|x| x.1)
                .unwrap_or(&props.report_data);
            if report_data
                .iter()
                .filter(|v| v.value.is_some())
                .next()
                .is_none()
            {
                None
            } else {
                match selected.data_type {
                    PracticeDataType::Int => {
                        let res = (report_data
                            .iter()
                            .map(|p| {
                                p.value.iter().flat_map(|v| v.as_int()).next().unwrap_or(0) as u64
                            })
                            .sum::<u64>()
                            / report_data.len() as u64)
                            .to_string();
                        Some((res.clone(), res))
                    }
                    PracticeDataType::Duration => {
                        let avg_mins = (report_data
                            .iter()
                            .flat_map(|p| p.value.iter().flat_map(|v| v.as_duration_mins()))
                            .map(|m| m as u64)
                            .sum::<u64>()
                            / report_data.len() as u64)
                            as u16;
                        Some((
                            avg_mins.to_string(),
                            PracticeEntryValue::Duration(avg_mins)
                                .as_duration_str()
                                .unwrap_or_default(),
                        ))
                    }
                    PracticeDataType::Time => {
                        let avg_mins = report_data
                            .iter()
                            .flat_map(|e| {
                                e.value.iter().map(|v| match v {
                                    PracticeEntryValue::Time { h, m } => {
                                        (*h as u64) * 60 + (*m as u64)
                                    }
                                    _ => 0,
                                })
                            })
                            .sum::<u64>()
                            / report_data
                                .iter()
                                .filter_map(|x| x.value.as_ref().map(|_| 1))
                                .sum::<u64>();
                        let h = (avg_mins / 60) as u8;
                        let m = (avg_mins % 60) as u8;

                        PracticeEntryValue::Time { h, m }
                            .as_time_str()
                            .into_iter()
                            .map(|s| (format!("2020-01-01 {}:00", s), s))
                            .next()
                    }
                    _ => None,
                }
            }
        })
        .next();

    let grid = html! {
            <Grid>
                <Ghead>
                    <Gh>{Locale::current().date()}</Gh>
                    <Gh>{selected_practice.as_ref().map(|p| p.practice.clone()).unwrap_or_default()}</Gh>
                </Ghead>
                <Gbody>{
                    for props.report_data.iter().map(|p| {
                        html! {
                            <Gr>
                                <Gd>{p.cob_date.format(DATE_FORMAT_HR).to_string()}</Gd>
                                <Gd>{
                                    p.value
                                        .as_ref()
                                        .map(|v| v.as_text())
                                        .unwrap_or_default()
                            }
                                </Gd>
                            </Gr>
                    }
                })
            }
                </Gbody>
            </Grid>
    };

    let data_body = if selected_practice
        .as_ref()
        .map(|inner| inner.data_type == PracticeDataType::Text)
        .unwrap_or(false)
    {
        html! {grid}
    } else {
        html! {
                <Chart
                    {x_values}
                    {y_values}
                    y_axis_type={selected_practice.as_ref().map(|p| p.data_type)}
                    avg_value_and_label={avg_value}
                    />
        }
    };

    html! {
        <div class={BODY_DIV_SPACE_10_CSS}>
            <div class={TWO_COLS_CSS}>
                <div class="relative">
                    <select
                        class={INPUT_CSS}
                        id="practices"
                        onchange={practice_onchange.clone()}
                        >
                        {for props.practices.iter().map(|p| html!{
                            <option class={"text-black"}
                                selected={
                                    selected_practice
                                        .as_ref()
                                        .map(|inner| inner.practice == p.practice)
                                        .unwrap_or(false)
                            }
                                value={p.practice.clone()}
                                >
                                {p.practice.clone()}
                            </option>
                    })}
                    </select>
                    <label for="practices" class={INPUT_LABEL_CSS}>
                        {format!(" {}: ", Locale::current().practice())}
                    </label>
                </div>
                <div class="relative">
                    <select class={INPUT_CSS} id="duration" onchange={duration_onchange.clone()}>
                        <option class={"text-black"} selected=true value={ReportDuration::Last7Days.to_string()}>{Locale::current().last_week()}</option>
                        <option class={"text-black"} value={ReportDuration::Last30Days.to_string()}>{Locale::current().last_month()}</option>
                        <option class={"text-black"} value={ReportDuration::Last90Days.to_string()}>{Locale::current().last_quarter()}</option>
                        <option class={"text-black"} value={ReportDuration::Last365Days.to_string()}>{Locale::current().last_year()}</option>
                    </select>
                    <label for="duration" class={INPUT_LABEL_CSS}>
                        {format!(" {}: ", Locale::current().duration())}
                    </label>
                </div>
            </div>
            <div class="relative">
                {data_body}
            </div>
        </div>
    }
}
