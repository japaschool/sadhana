use std::str::FromStr;

use crate::{
    components::{blank_page::BlankPage, chart::Chart, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, PracticeEntryValue},
    services::{get_chart_data, get_user_practices},
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

    let selected_practice = use_state(|| None);

    {
        let selected_practice = selected_practice.clone();
        use_effect_with_deps(
            move |all_practices| {
                all_practices.data.iter().for_each(|inner| {
                    inner
                        .iter()
                        .next()
                        .iter()
                        .for_each(|&p| selected_practice.set(Some(p.clone())))
                });
                || ()
            },
            all_practices.clone(),
        );
    }

    let duration = use_state(|| ReportDuration::Last30Days);

    let duration_onchange = {
        let dur = duration.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            if let Ok(d) = ReportDuration::from_str(&input.value()) {
                dur.set(d);
            };
        })
    };

    let practice_onchange = {
        let all_practices = all_practices.clone();
        let selected_practice = selected_practice.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            all_practices.data.iter().for_each(|inner| {
                inner
                    .iter()
                    .find(|p| p.practice == input.value())
                    .iter()
                    .for_each(|&p| selected_practice.set(Some(p.clone())))
            });
        })
    };

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

    {
        let report_data = report_data.clone();
        use_effect_with_deps(
            move |_| {
                report_data.run();
                || ()
            },
            (selected_practice.clone(), duration.clone()),
        );
    }

    const DATE_FORMAT: &'static str = "%Y-%m-%d";

    let x_values = use_state(|| vec![]);
    let y_values = use_state(|| vec![]);

    {
        let x_values = x_values.clone();
        let y_values = y_values.clone();
        let selected = selected_practice.clone();
        use_effect_with_deps(
            move |report_data| {
                let (xs, ys) = selected
                    .as_ref()
                    .zip(report_data.data.as_ref())
                    .iter()
                    .flat_map(|(selected, inner)| {
                        inner.iter().map(|p| {
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

                x_values.set(xs);
                y_values.set(ys);
                || ()
            },
            report_data.clone(),
        );
    }

    html! {
        <BlankPage show_footer=true >
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={report_data.error.clone()} />
            <div class={ BODY_DIV_CSS }>
                <div class="relative">
                    <select class={ INPUT_CSS } id="practices" onchange={ practice_onchange.clone() }>
                        { for all_practices.data.iter().flat_map(|inner| inner.iter()).map(|p| html!{
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
                        x_values={ (*x_values).clone() }
                        y_values={ (*y_values).clone() }
                        y_axis_type={ selected_practice.as_ref().map(|p| p.data_type) }
                        />
                </div>
            </div>
        </BlankPage>
    }
}
