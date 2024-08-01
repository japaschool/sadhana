use std::{
    collections::{BTreeMap, HashSet},
    str::FromStr,
};

use super::{GraphReport, PracticeTrace, Report, ReportDefinition, SelectedReportId};
use crate::{
    components::{
        chart::{self, Chart},
        grid::*,
    },
    css::*,
    i18n::Locale,
    model::{PracticeDataType, PracticeEntryValue, ReportDataEntry, UserPractice},
    routes::charts::GridReport,
};
use chrono::Local;
use common::ReportDuration;
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct ChartBaseProps {
    pub practices: Vec<UserPractice>,
    pub reports: Vec<Report>,
    pub report_data: Vec<ReportDataEntry>,
    pub dates_onchange: Callback<ReportDuration>,
    pub report_onchange: Callback<SelectedReportId>,
    pub report: Report,
}

const DATE_FORMAT: &str = "%Y-%m-%d";
const DATE_FORMAT_HR: &str = "%a, %d %b";
const DURATION_STORAGE_KEY: &str = "charts.selected_duration";

#[function_component(ChartsBase)]
pub fn charts_base(props: &ChartBaseProps) -> Html {
    let duration = use_state(|| {
        let res = LocalStorage::get::<ReportDuration>(DURATION_STORAGE_KEY);
        log::debug!("Duration in storage {:?}", res);
        res.unwrap_or(ReportDuration::Week)
    });

    {
        let cb = props.dates_onchange.clone();
        use_effect_with(duration.clone(), move |d| {
            cb.emit((**d).clone());
            || ()
        });
    }

    let duration_onchange = {
        let dur = duration.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            if let Ok(d) = ReportDuration::from_str(&input.value()) {
                dur.set(d.clone());
                LocalStorage::set(DURATION_STORAGE_KEY, d).unwrap();
            };
        })
    };

    let report_onchange = {
        let cb = props.report_onchange.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            cb.emit(SelectedReportId::new(input.value()));
        })
    };

    let graph_traces = |traces: &Vec<PracticeTrace>| {
        log::debug!("Making graph traces from {:?}", traces);

        traces
            .iter()
            .filter(|trace| trace.practice.is_some())
            .map(
                |PracticeTrace {
                     label,
                     type_,
                     practice,
                     y_axis,
                     show_average,
                 }| {
                    let selected_practice = props
                        .practices
                        .iter()
                        .find(|p| practice.iter().any(|practice| *practice == p.id));
                    let report_data = if let Some(&p) = selected_practice.as_ref() {
                        props
                            .report_data
                            .iter()
                            .filter(|entry| entry.practice == p.practice)
                            .collect()
                    } else {
                        vec![]
                    };

                    let adjust_time = if selected_practice
                        .filter(|p| p.data_type == PracticeDataType::Time)
                        .is_some()
                    {
                        overflow_time(&report_data)
                    } else {
                        0
                    };

                    let (x_values, y_values): (Vec<_>, Vec<_>) = selected_practice
                        .iter()
                        .flat_map(|selected| {
                            report_data.iter().map(|p| {
                                (
                                    p.cob_date.format(DATE_FORMAT).to_string(),
                                    y_value(&selected.data_type, p, adjust_time),
                                )
                            })
                        })
                        .unzip();

                    let avg_value = selected_practice
                        .filter(|_| *show_average)
                        .and_then(|p| average_value(&p.data_type, &report_data, adjust_time));

                    chart::Graph {
                        name: label.to_owned(),
                        type_: type_.to_owned(),
                        x_values,
                        y_values,
                        y_axis_type: selected_practice
                            .map(|p| p.data_type)
                            .unwrap_or(PracticeDataType::Int),
                        y_axis: y_axis.to_owned(),
                        average: avg_value,
                    }
                },
            )
            .collect::<Vec<_>>()
    };

    let practice_names_dict = |gr: &GridReport| {
        props
            .practices
            .iter()
            .filter_map(|p| gr.practices.contains(&p.id).then_some(p.practice.clone()))
            .collect::<HashSet<_>>()
    };

    let grid_data_by_cob = |gr: &GridReport| {
        let practices = practice_names_dict(gr);
        let mut grouped = BTreeMap::new();
        for entry in props
            .report_data
            .iter()
            .filter(|entry| practices.contains(&entry.practice))
        {
            let record = grouped.entry(&entry.cob_date).or_insert(vec![]);
            record.push(entry);
        }
        grouped
    };

    let grid_report = |gr: &GridReport| {
        html! {
            <Grid>
                <Ghead>
                    <Gh>{Locale::current().date()}</Gh>
                    {for props
                        .practices
                        .iter()
                        .filter(|p| gr.practices.contains(&p.id))
                        .map(|p| html! { <Gh>{p.practice.clone()}</Gh> })
                    }
                </Ghead>
                <Gbody>
                    {for grid_data_by_cob(gr).iter().map(|(cob, data)| {
                        html! {
                            <Gr>
                                <Gd>{cob.format(DATE_FORMAT_HR).to_string()}</Gd>
                                {for data.iter().map(|entry| html! {
                                    <Gd>{
                                        entry.value
                                            .as_ref()
                                            .map(|v| v.to_string())
                                            .unwrap_or_default()
                                    }</Gd>
                                })}
                            </Gr>
                        }
                    })}
                </Gbody>
            </Grid>
        }
    };

    let data_body = match &props.report.definition {
        ReportDefinition::Grid(grid_rep) => html! {grid_report(grid_rep)},
        ReportDefinition::Graph(GraphReport { bar_layout, traces }) => html! {
        <Chart
            traces={graph_traces(traces)}
            bar_mode={bar_layout.clone()}
            />
        },
    };

    html! {
        <div class={BODY_DIV_SPACE_10_CSS}>
            <div class={TWO_COLS_CSS}>
                <div class="relative">
                    <select
                        class={INPUT_CSS}
                        id="report"
                        onchange={report_onchange.clone()}
                        >
                        {for props.reports.iter().map(|r| html!{
                            <option class={"text-black"}
                                selected={props.report.id == r.id}
                                value={r.id.clone()}
                                >
                                {r.name.clone()}
                            </option>
                    })}
                    </select>
                    <label for="report" class={INPUT_LABEL_CSS}>
                        {format!(" {}: ", Locale::current().report())}
                    </label>
                </div>
                <div class="relative">
                    <select class={INPUT_CSS} id="duration" onchange={duration_onchange.clone()}>
                        { for [
                            (ReportDuration::Week, Locale::current().report_dur_week()),
                            (ReportDuration::Month, Locale::current().report_dur_month()),
                            (ReportDuration::Quarter, Locale::current().report_dur_quarter()),
                            (ReportDuration::HalfYear, Locale::current().report_dur_half_year()),
                            (ReportDuration::Year, Locale::current().report_dur_year()),
                            (ReportDuration::AllData, Locale::current().report_dur_all_data()),
                            ].iter().map(|(dur, label)| html!{
                                <option
                                    class={"text-black"}
                                    selected={*dur == *duration}
                                    value={dur.to_string()}
                                    >
                                    {label}
                                    </option>
                            })
                        }
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

fn average_value(
    data_type: &PracticeDataType,
    report_data: &Vec<&ReportDataEntry>,
    overflow_time: i8,
) -> Option<chart::GraphAverage> {
    let today = Local::now().date_naive();
    // Remove today's data from the average calculation as it might not be full yet
    let report_data = report_data
        .split_last()
        .filter(|(last, _)| last.cob_date == today)
        .map(|x| x.1)
        .unwrap_or(report_data);

    if !report_data.iter().any(|v| v.value.is_some()) {
        None
    } else {
        match data_type {
            PracticeDataType::Int => {
                let res = (report_data
                    .iter()
                    .map(|p| p.value.iter().flat_map(|v| v.as_int()).next().unwrap_or(0) as u64)
                    .sum::<u64>()
                    / report_data.len() as u64)
                    .to_string();
                Some(chart::GraphAverage::new(res.clone(), res))
            }
            PracticeDataType::Duration => {
                let avg_mins = (report_data
                    .iter()
                    .flat_map(|p| p.value.iter().flat_map(|v| v.as_duration_mins()))
                    .map(|m| m as u64)
                    .sum::<u64>()
                    / report_data.len() as u64) as u16;
                Some(chart::GraphAverage::new(
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
                                // Start in day 2 to allow moving forward and backward by a day
                                let mut h2 = *h + 48;
                                if overflow_time > 0 && *h < 12 {
                                    h2 += 24;
                                } else if overflow_time < 0 && *h > 15 {
                                    h2 -= 24;
                                }
                                (h2 as u64) * 60 + (*m as u64)
                            }
                            _ => 0,
                        })
                    })
                    .sum::<u64>()
                    / report_data
                        .iter()
                        .filter_map(|x| x.value.as_ref().map(|_| 1))
                        .sum::<u64>();
                let mut h = (avg_mins / 60) as u8;
                let d = h / 24;
                let m = (avg_mins % 60) as u8;

                h %= 24;

                PracticeEntryValue::Time { h, m }
                    .as_time_str()
                    .into_iter()
                    .map(|s| chart::GraphAverage::new(format!("2020-01-0{d} {s}:00"), s))
                    .next()
            }
            _ => None,
        }
    }
}

/// Calculate whether time entries spill into the previous/next day.
/// Assumes time entries are clustered either in the morning or evening.
/// Counts number of entries in the morning and evening. If most are in
/// evening but there are some in the morning, returns +1 to shift those
/// morning ones into the next day.
/// Similarly, if most are morning but some evening, returns -1 to move
/// the evening entries into the previous day.
fn overflow_time(report_data: &[&ReportDataEntry]) -> i8 {
    let mut morning_cnt = 0;
    let mut evening_cnt = 0;

    for h in report_data.iter().filter_map(|v| {
        v.value.as_ref().and_then(|v| match v {
            PracticeEntryValue::Time { h, m: _ } => Some(*h),
            _ => None,
        })
    }) {
        if h < 24 && h > 15 {
            evening_cnt += 1;
        }

        if h < 12 {
            morning_cnt += 1;
        }
    }

    if morning_cnt > evening_cnt {
        -1
    } else {
        1
    }
}

fn y_value(data_type: &PracticeDataType, entry: &ReportDataEntry, adjust_time: i8) -> String {
    match data_type {
        PracticeDataType::Int => entry
            .value
            .as_ref()
            .and_then(|v| v.as_int())
            .map(|i| i.to_string())
            .unwrap_or_default(),
        PracticeDataType::Time => entry
            .value
            .as_ref()
            .and_then(|v| {
                let mut d = 2;
                if let PracticeEntryValue::Time { h, m: _ } = v {
                    if adjust_time < 0 && *h > 15 {
                        d -= 1;
                    } else if adjust_time > 0 && *h < 12 {
                        d += 1;
                    }
                }
                v.as_time_str().map(|s| format!("2020-01-0{d} {s}:00"))
            })
            .unwrap_or_default(),
        PracticeDataType::Duration => entry
            .value
            .as_ref()
            .and_then(|v| match v {
                PracticeEntryValue::Duration(minutes) => Some(minutes.to_string()),
                _ => None,
            })
            .unwrap_or_default(),
        PracticeDataType::Text => entry
            .value
            .as_ref()
            .map(|_| "1".to_string())
            .unwrap_or_default(),
        PracticeDataType::Bool => entry
            .value
            .as_ref()
            .and_then(|v| v.as_bool())
            .filter(|&b| b)
            .map(|_| "1".to_string())
            .unwrap_or_default(),
    }
}
