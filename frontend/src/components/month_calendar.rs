use std::collections::HashSet;

use super::calendar::{
    HOVER_DATE_COLOR_CSS, HOVER_TODAY_DATE_COLOR_CSS, SELECTED_TODAY_DATE_COLOR_CSS,
};
use chrono::{Datelike, Local, Months, NaiveDate};
use tw_merge::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;

use crate::{
    css::POPUP_BG_CSS,
    hooks::SessionStateContext,
    i18n::{Locale, DAYS},
    services::get_incomplete_days,
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub close: Callback<MouseEvent>,
    #[prop_or(false)]
    pub highlight_incomplete_dates: bool,
}

const DAY_CSS: & str = "cursor-pointer text-center text-md rounded-full leading-loose transition-all ease-in-out duration-300";

#[function_component(MonthCalendar)]
pub fn month_calendar(props: &Props) -> Html {
    let today: NaiveDate = Local::now().date_naive();
    let session_ctx = use_context::<SessionStateContext>().expect("No session state ctx found");
    let month_start = use_state(|| {
        NaiveDate::from_ymd_opt(
            session_ctx.selected_date.year(),
            session_ctx.selected_date.month(),
            1,
        )
        .unwrap()
    });
    let num_blank_days = month_start.weekday().number_from_monday();
    let next_month_start = month_start.checked_add_months(Months::new(1)).unwrap();
    let num_days = next_month_start
        .signed_duration_since(*month_start)
        .num_days() as u32;

    let is_today = |day| {
        today.day() == day
            && month_start.month() == today.month()
            && month_start.year() == today.year()
    };
    let is_selected = |day| session_ctx.selected_date.day() == day;

    let day_class = |day| {
        let color_css = match (is_selected(day), is_today(day)) {
            (true, true) => {
                format!("text-zinc-500 dark:text-zinc-100 {SELECTED_TODAY_DATE_COLOR_CSS}")
            }
            (true, false) => "text-zinc-500 dark:text-zinc-100 shadow-inset-amber-400".into(),
            (false, true) => format!("text-amber-400 {HOVER_TODAY_DATE_COLOR_CSS}"),
            (false, false) => format!("text-zinc-500 dark:text-zinc-100 {HOVER_DATE_COLOR_CSS}"),
        };
        format!("{DAY_CSS} {color_css}")
    };

    let incomplete_days = {
        let enabled = props.highlight_incomplete_dates;
        let month_start = month_start.clone();
        use_async(async move {
            if enabled {
                let end = next_month_start.pred_opt().unwrap();
                get_incomplete_days(&month_start, &end)
                    .await
                    .map(|res| res.days.iter().map(|d| d.day()).collect::<HashSet<_>>())
            } else {
                Ok(HashSet::default())
            }
        })
    };

    {
        let incomplete_days = incomplete_days.clone();
        use_effect_with(month_start.clone(), move |_| {
            incomplete_days.run();
            || ()
        });
    }

    let next_month_onclick = {
        let month_start = month_start.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            let new_value = month_start.checked_add_months(Months::new(1)).unwrap();
            month_start.set(new_value);
        })
    };

    let prev_month_onclick = {
        let month_start = month_start.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            let new_value = month_start.checked_sub_months(Months::new(1)).unwrap();
            month_start.set(new_value);
        })
    };

    let cancel_onclick = {
        let close = props.close.clone();
        Callback::from(move |e| {
            close.emit(e);
        })
    };

    let day_onclick = {
        let month_start = month_start.clone();
        let close = props.close.clone();
        let session = session_ctx.clone();
        Callback::from(move |e: MouseEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let day: u32 = input.id().parse().unwrap();
            let selected_date =
                NaiveDate::from_ymd_opt(month_start.year(), month_start.month(), day).unwrap();
            session.dispatch(selected_date);
            close.emit(e);
        })
    };

    let today_onclick = {
        let session = session_ctx.clone();
        let close = props.close.clone();
        Callback::from(move |e| {
            session.dispatch(today);
            close.emit(e);
        })
    };

    html! {
        <div
            class={"fixed left-0 top-0 flex w-full h-full items-center justify-center z-10 antialiased"}
            >
            <div class="fixed top-0 bottom-0 left-0 right-0 bg-black bg-opacity-30" onclick={cancel_onclick} />
            <div class="relative">
                <div class="container">
                    <div
                        class={tw_merge!("p-4", POPUP_BG_CSS)}
                        style="width: 19rem"
                        >
                        <div class="flex justify-between items-center mb-2">
                            <div>
                                <span class="text-lg font-bold text-gray-800 dark:text-white">{Locale::current().month_name(month_start.month())}</span>
                                <span class="ml-1 text-lg text-gray-600 dark:text-white font-normal">{month_start.year()}</span>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    class="transition ease-in-out duration-100 inline-flex cursor-pointer can-hover:hover:bg-gray-200 p-1 rounded-full"
                                    onclick={prev_month_onclick}
                                    >
                                    <svg class="h-6 w-6 text-gray-500 dark:text-white inline-flex" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    class="transition ease-in-out duration-100 inline-flex cursor-pointer can-hover:hover:bg-gray-200 p-1 rounded-full"
                                    onclick={next_month_onclick}
                                    >
                                    <svg class="h-6 w-6 text-gray-500 dark:text-white inline-flex"  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div class="flex flex-wrap mb-3 -mx-1">
                            { for DAYS
                                .iter()
                                .map(|day| html!{
                                    <div style="width: 14.26%" class="px-1" key={day.to_string()}>
                                        <div class="text-gray-800 dark:text-white font-medium text-center text-xs">{day}</div>
                                    </div>
                                })
                            }
                        </div>

                        <div class="flex flex-wrap -mx-1">
                            {for (1..num_blank_days).map(|_| html! {
                                <div style="width: 14.28%" class="text-center border p-1 border-transparent text-md"/>
                            })}
                            {for (1..=num_days).map(|day| html! {
                                <div id={day.to_string()} style="width: 14.28%" class="px-1 mb-1" onclick={day_onclick.clone()} >
                                    if incomplete_days.data.as_ref().iter().any(|data| data.contains(&day)) {
                                        <span id={day.to_string()} class="absolute ml-5 w-2 h-2 bg-red-500 rounded-full"></span>
                                    }
                                    <div id={day.to_string()} class={day_class(day)}>{day}</div>
                                </div>
                            })}
                        </div>

                        <div class="px-1 mt-2">
                            <a class={"cursor-pointer text-base font-bold text-amber-400"} onclick={today_onclick}>{"Today"}</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}
