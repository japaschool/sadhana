use std::collections::{HashMap, HashSet};

use super::{GraphReport, PracticeTrace};
use crate::{
    components::{
        chart::{BarGraphLayout, GraphType, LineConf, LineStyle, YAxis},
        summary_details::SummaryDetails,
    },
    css::*,
    i18n::*,
    model::UserPractice,
};

use lazy_static::lazy_static;
use web_sys::HtmlInputElement;
use yew::prelude::*;

lazy_static! {
    static ref ALL_AXISES: Vec<(YAxis, String)> = vec![
        (YAxis::Y, Locale::current().left()),
        (YAxis::Y2, Locale::current().right()),
        (YAxis::Y3, format!("{} 2", Locale::current().left())),
        (YAxis::Y4, format!("{} 2", Locale::current().right())),
        (YAxis::Y5, format!("{} 3", Locale::current().left())),
        (YAxis::Y6, format!("{} 3", Locale::current().right())),
        (YAxis::Y7, format!("{} 4", Locale::current().left())),
        (YAxis::Y8, format!("{} 4", Locale::current().right())),
    ];
}
#[derive(Properties, PartialEq)]
pub struct Props {
    pub all_practices: Vec<UserPractice>,
    pub report: GraphReport,
    pub report_name: AttrValue,
    pub report_onchange: Callback<(String, GraphReport)>,
    pub report_ondelete: Callback<()>,
}

#[function_component(GraphEditor)]
pub fn graph_editor(props: &Props) -> Html {
    let report = use_state(|| props.report.clone());
    let report_name = use_state(|| props.report_name.to_string());

    let mut all_practices_by_data_type = HashMap::new();
    let mut practice_to_data_type = HashMap::with_capacity(props.all_practices.len());

    for v in props.all_practices.iter() {
        let record = all_practices_by_data_type
            .entry(v.data_type)
            .or_insert(vec![]);
        record.push(v.to_owned());
        practice_to_data_type.insert(v.id.clone(), v.clone());
    }

    {
        let cb = props.report_onchange.clone();
        use_effect_with_deps(
            move |(name, rep)| {
                cb.emit(((**name).clone(), (**rep).clone()));
                || ()
            },
            (report_name.clone(), report.clone()),
        );
    }

    let report_name_oninput = {
        let report_name = report_name.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            report_name.set(input.value());
        })
    };

    let bar_layout_onchange = {
        let report = report.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let new_layout = input.value().parse().unwrap();
            report.set(GraphReport::new(new_layout, report.traces.clone()));
        })
    };

    let practice_onchange = {
        let report = report.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let practice = input.value();
            let mut new_traces = report.traces.clone();
            new_traces[idx].practice = Some(practice);
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let axis_onchange = {
        let report = report.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let axis: YAxis = input.value().parse().unwrap();
            let mut new_traces = report.traces.clone();
            new_traces[idx].y_axis = Some(axis);
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let graph_type_onchange = {
        let report = report.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let gt = match input.value().as_str() {
                "bar" => GraphType::Bar,
                "line" => GraphType::Line(LineConf::new(LineStyle::Regular)),
                "dot" => GraphType::Dot,
                _ => unreachable!(),
            };
            let mut new_traces = report.traces.clone();
            new_traces[idx].type_ = gt;
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let trace_name_oninput = {
        let report = report.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut new_traces = report.traces.clone();
            new_traces[idx].label = Some(input.value().trim().to_string()).filter(|s| !s.is_empty());
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let show_avg_onclick = {
        let report = report.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut new_traces = report.traces.clone();
            new_traces[idx].show_average = input.checked();
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let delete_trace_onclick = {
        let report = report.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut new_traces = report.traces.clone();
            new_traces.remove(idx);
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let add_trace_onclick = {
        let report = report.clone();
        Callback::from(move |_: MouseEvent| {
            let mut new_traces = report.traces.clone();
            new_traces.push(PracticeTrace::default());
            report.set(GraphReport::new(report.bar_layout.clone(), new_traces));
        })
    };

    let delete_report_onclick = {
        let cb = props.report_ondelete.clone();
        Callback::from(move |_: MouseEvent| {
            cb.emit(());
        })
    };

    // Assumes None is the same as Some(Y)
    let axises_eq = |l: &Option<YAxis>, r: &Option<YAxis>| {
        l.as_ref().or_else(|| Some(&YAxis::Y)) == r.as_ref().or_else(|| Some(&YAxis::Y))
    };

    let is_shared_axis = |trace_idx, axis: &Option<YAxis>| {
        report
            .traces
            .iter()
            .enumerate()
            .filter(|(idx, _)| *idx != trace_idx)
            .any(|(_, trace)| axises_eq(&trace.y_axis, axis))
    };

    // An axis can be shared only with practices of the same data type
    let axises_for_trace = |practice: &Option<String>| {
        let trace_dt = practice.as_ref().and_then(|p| practice_to_data_type.get(p));
        let unusable = report
            .traces
            .iter()
            .filter_map(|trace| {
                trace
                    .practice
                    .as_ref()
                    .and_then(|p| practice_to_data_type.get(p))
                    .filter(|dt| trace_dt.iter().any(|dt1| dt1.data_type != dt.data_type))
                    .and_then(|_| trace.y_axis.clone())
            })
            .collect::<HashSet<_>>();

        ALL_AXISES
            .iter()
            .filter(|(a, _)| !unusable.contains(a))
            .collect::<Vec<_>>()
    };

    // An axis can be shared only with practices of the same data type
    let practices_for_trace = |trace_idx, axis, practice: &Option<String>| {
        is_shared_axis(trace_idx, axis)
            .then(|| {
                practice
                    .as_ref()
                    .or_else(|| {
                        // If practice isn't selected yet, look up another practice on the same axis
                        report
                            .traces
                            .iter()
                            .filter_map(|t| axises_eq(&t.y_axis, axis).then_some(&t.practice))
                            .flatten()
                            .next()
                    })
                    .and_then(|p| practice_to_data_type.get(p))
                    .and_then(|dt| all_practices_by_data_type.get(&dt.data_type))
            })
            .flatten()
            .or(Some(&props.all_practices))
    };

    let graph_settings = html! {
        <SummaryDetails tab_index={0} label={Locale::current().settings()}>
            <div class="pt-8">
                <div class={TWO_COLS_CSS}>
                    <div class="relative">
                        <input
                            type="text"
                            id="name"
                            placeholder="Name"
                            value={(*report_name).clone()}
                            oninput={report_name_oninput}
                            class={INPUT_CSS}
                            required = true
                            autocomplete="off"
                            />
                        <label for="name" class={INPUT_LABEL_CSS}>
                            { format!(" {}", Locale::current().report_name())}
                        </label>
                    </div>
                    <div class="relative">
                        <select class={INPUT_CSS} id="bar-layout" onchange={bar_layout_onchange}>
                                <option
                                    selected={report.bar_layout == BarGraphLayout::Grouped}
                                    value={BarGraphLayout::Grouped.to_string()}
                                    class={"text-black"}>
                                    {Locale::current().report_bar_layout_grouped()}
                                </option>
                                <option
                                    selected={report.bar_layout == BarGraphLayout::Stacked}
                                    value={BarGraphLayout::Stacked.to_string()}
                                    class={"text-black"}>
                                    {Locale::current().report_bar_layout_stacked()}
                                </option>
                                <option
                                    selected={report.bar_layout == BarGraphLayout::Overlaid}
                                    value={BarGraphLayout::Overlaid.to_string()}
                                    class={"text-black"}>
                                    {Locale::current().report_bar_layout_overlaid()}
                                </option>
                        </select>
                        <label for="bar-layout" class={INPUT_LABEL_CSS}>
                            {format!(" {}: ", Locale::current().report_bar_layout())}
                        </label>
                    </div>
                </div>
            </div>
        </SummaryDetails>
    };

    let graph_trace_editors = report.traces.iter().enumerate().map(|(idx, PracticeTrace { label, type_, practice, y_axis, show_average })| html! {
        <SummaryDetails tab_index={(idx + 1) as u8} label={format!("{} {}", Locale::current().report_trace(), idx + 1)}>
            <div class="pt-8">
                <div class={TWO_COLS_CSS}>
                    <div class="relative">
                        <select class={INPUT_CSS} id={idx.to_string()} onchange={practice_onchange.clone()} required=true>
                            <option 
                                class={"text-black"} 
                                value="" 
                                selected={practice.is_none()} 
                                disabled=true 
                                style="display:none">
                                {Locale::current().choose_practice()}
                            </option>
                            {for practices_for_trace(idx, y_axis, practice).iter().flat_map(|inner| inner.iter()).map(|p| html! {
                                <option selected={practice.iter().any(|inner| *inner == p.id)} value={p.id.clone()} class={"text-black"}>
                                    {p.practice.clone()}
                                </option>
                            })}
                        </select>
                        <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                            {format!(" {}: ", Locale::current().practice())} 
                        </label>
                    </div>
                    <div class="relative">
                        <select class={INPUT_CSS} id={idx.to_string()} onchange={axis_onchange.clone()} disabled={practice.is_none()}>
                            <option 
                                class={"text-black"} 
                                value="" 
                                selected={y_axis.is_none()} 
                                disabled=true 
                                style="display:none">
                                {Locale::current().report_choose_axis()}
                            </option>
                            {for axises_for_trace(practice).iter().map(|(axis, label)| html! {
                                <option selected={y_axis.iter().any(|a| a == axis)} value={axis.to_string()} class={"text-black"}>
                                    {label}
                                </option>
                            })}
                        </select>
                        <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                            {format!(" {}: ", Locale::current().report_axis())}
                        </label>
                    </div>
                    <div class="relative">
                        <select class={INPUT_CSS} id={idx.to_string()} onchange={graph_type_onchange.clone()}>
                            <option 
                                class={"text-black"} 
                                value={"bar"} 
                                selected={*type_ == GraphType::Bar}>
                                {Locale::current().report_graph_type_bar()}
                            </option> 
                            <option 
                                class={"text-black"} 
                                value={"line"} 
                                selected={matches!(*type_, GraphType::Line(_))}>
                                {Locale::current().report_graph_type_line()}
                            </option> 
                            <option 
                                class={"text-black"} 
                                value={"dot"} 
                                selected={*type_ == GraphType::Dot}>
                                {Locale::current().report_graph_type_dot()}
                            </option> 
                        </select>
                        <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                            {format!(" {}: ",  Locale::current().report_graph_type())} 
                        </label>
                    </div>
                    <div class="relative">
                        <input
                            type="text"
                            id={idx.to_string()}
                            placeholder="Label"
                            value={label.to_owned().unwrap_or_default()}
                            oninput={trace_name_oninput.clone()}
                            class={INPUT_CSS}
                            />
                        <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                            {Locale::current().report_trace_label()}
                        </label>
                    </div>
                    <div class="relative">
                        <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                            <span>{Locale::current().report_show_average()}</span> 
                            <input
                                id="checkbox"
                                type="checkbox"
                                onclick={show_avg_onclick.clone()}
                                id={idx.to_string()}
                                checked={*show_average}
                                />
                        </label>
                    </div>
                    <div class="relative">
                        <button 
                            id={idx.to_string()} 
                            class={BTN_CSS} 
                            onclick={delete_trace_onclick.clone()}>
                            {Locale::current().report_trace_delete()}
                        </button> 
                    </div>
                </div>
            </div>
        // <div class="group-focus:max-h-screen focus-within:max-h-screen max-h-0 px-4 overflow-hidden">
            // <p class="pl-4 pr-4 pt-0 pb-2">{"Answer: "}<a href="https://stackoverflow.com">{"Under development"}</a></p>
        </SummaryDetails>
    }).collect::<Html>();

    html! {
        <div class="pt-8 text-zinc-500 dark:text-zinc-100">
            {graph_settings}
            {graph_trace_editors}
            <div class="pt-8">
                <div class={TWO_COLS_CSS}>
                    <div class="relative">
                        <button 
                            type="button" 
                            class={BTN_CSS_NO_MARGIN} 
                            onclick={add_trace_onclick.clone()}>
                            {Locale::current().report_trace_add()}
                        </button> 
                    </div>
                    <div class="relative">
                        <button 
                            type="button" 
                            class={BTN_CSS_NO_MARGIN} 
                            onclick={delete_report_onclick.clone()}>
                            {Locale::current().report_delete()}
                        </button> 
                    </div>
                </div>
            </div>
        </div>
    }
}
