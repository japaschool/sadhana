use std::str::FromStr;

use crate::{
    components::{blank_page::BlankPage, chart::Chart, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, PracticeEntryValue, ReportDataEntry, UserPractice},
    services::{get_chart_data, get_shared_practices, get_user_practices},
};
use common::ReportDuration;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

#[function_component(Charts)]
pub fn charts() -> Html {
    let all_practices = use_async(async move {
        get_user_practices().await.map(|res| {
            res.user_practices
                .into_iter()
                .filter(|p| p.is_active)
                .collect::<Vec<_>>()
        })
    });

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        use_mount(move || {
            all_practices.run();
        });
    }

    let selected_practice = use_state(|| None as Option<UserPractice>);
    let duration = use_state(|| ReportDuration::Last30Days);

    let report_data = {
        let practice = selected_practice.clone();
        let duration = duration.clone();
        use_async(async move {
            match &*practice {
                Some(p) => get_chart_data(&p.practice, &*duration)
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
        <BlankPage show_footer=true loading={all_practices.data.is_none()}>
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
pub struct SharedChartsProps {
    share_id: AttrValue,
}

#[function_component(SharedCharts)]
pub fn shared_charts(props: &SharedChartsProps) -> Html {
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

    let selected_practice = use_state(|| {
        Some(UserPractice {
            practice: "Books".into(),
            data_type: PracticeDataType::Duration,
            is_active: true,
        })
    });
    let duration = use_state(|| ReportDuration::Last30Days);

    let report_data = {
        let practice = selected_practice.clone();
        let duration = duration.clone();
        use_async(async move {
            match &*practice {
                Some(p) => get_chart_data(&p.practice, &*duration)
                    .await
                    .map(|res| res.values),
                None => Ok(vec![]),
            }
        })
    };

    let pull_data = {
        let duration = duration.clone();
        let selected_practice = selected_practice.clone();
        let report_data = report_data.clone();
        Callback::from(move |(practice, dur)| {
            duration.set(dur);
            selected_practice.set(Some(practice));
            report_data.run();
        })
    };

    html! {
        <BlankPage show_footer=true >
            <ListErrors error={report_data.error.clone()} />
            <ChartsBase
                practices={all_practices.data.clone().unwrap_or_default()}
                report_data={report_data.data.clone().unwrap_or_default()}
                {pull_data}/>
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

#[function_component(ChartsBase)]
fn charts_base(props: &ChartBaseProps) -> Html {
    let selected_practice = use_state(|| props.practices.first().cloned());
    let duration = use_state(|| ReportDuration::Last30Days);

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

    const DATE_FORMAT: &'static str = "%Y-%m-%d";

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
                                PracticeEntryValue::Duration(minutes) => {
                                    let h = minutes / 60;
                                    let m = minutes % 60;
                                    Some(format!(
                                        "2020-01-01 {:0width$}:{:0width$}:00",
                                        h,
                                        m,
                                        width = 2
                                    ))
                                }
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

    html! {
            <div class={ BODY_DIV_CSS }>
                <div class="relative">
                    <select  class={ INPUT_CSS } id="practices" onchange={ practice_onchange.clone() }>
                        { for props.practices.iter().map(|p| html!{
                            <option class={ "text-black" }
                                selected={ selected_practice.as_ref().map(|inner| inner.practice == p.practice).unwrap_or(false) }
                                value={ p.practice.clone() }
                                >{ p.practice.clone() }</option>
                        })}
                    </select>
                    <label for="practices" class={ INPUT_LABEL_CSS }>
                        <i class="fa"></i>
                        { format!(" {}: ", Locale::current().practice()) }
                    </label>
                </div>
                <div class="relative">
                    <select class={ INPUT_CSS } id="duration" onchange={ duration_onchange.clone() }>
                        <option class={ "text-black" } selected=true value={ ReportDuration::Last30Days.to_string() }>{ Locale::current().last_month() }</option>
                        <option class={ "text-black" } value={ ReportDuration::Last90Days.to_string() }>{ Locale::current().last_quarter() }</option>
                        <option class={ "text-black" } value={ ReportDuration::Last365Days.to_string() }>{ Locale::current().last_year() }</option>
                    </select>
                    <label for="duration" class={ INPUT_LABEL_CSS }>
                        <i class="fa"></i>
                        { format!(" {}: ", Locale::current().duration()) }
                    </label>
                </div>
                <div class="relative">
                    <Chart
                        { x_values }
                        { y_values }
                        y_axis_type={ selected_practice.as_ref().map(|p| p.data_type) }
                        />
                </div>
            </div>
    }
}
