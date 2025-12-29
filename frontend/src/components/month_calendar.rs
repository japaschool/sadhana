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
        <div class="fixed inset-0 z-10 flex items-center justify-center antialiased">
            <div
                class="fixed inset-0 bg-black bg-opacity-30"
                onclick={cancel_onclick}
            />

            <div class="relative">
                <div class="container">
                    <div class={tw_merge!("p-4", POPUP_BG_CSS)}>

                        // Header
                        <div class="mb-2 flex items-center justify-between">
                            <div>
                                <span class="text-lg font-bold text-gray-800 dark:text-white">
                                    { Locale::current().month_name(month_start.month()) }
                                </span>
                                <span class="ml-1 text-lg font-normal text-gray-600 dark:text-white">
                                    { month_start.year() }
                                </span>
                            </div>

                            <div class="flex">
                                <button
                                    type="button"
                                    class="inline-flex rounded-full p-1 transition can-hover:hover:bg-gray-200"
                                    onclick={prev_month_onclick}
                                >
                                    <svg class="h-6 w-6 text-gray-500 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    class="inline-flex rounded-full p-1 transition can-hover:hover:bg-gray-200"
                                    onclick={next_month_onclick}
                                >
                                    <svg class="h-6 w-6 text-gray-500 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        // Weekday header
                        <div class="mb-3 grid grid-cols-7 gap-x-1">
                            { for DAYS.iter().map(|day| html! {
                                <div class="text-center text-xs font-medium text-gray-800 dark:text-white whitespace-nowrap"
                                     key={day.to_string()}>
                                    { day }
                                </div>
                            }) }
                        </div>

                        // Calendar grid
                        <div class="grid grid-cols-7 gap-x-1 gap-y-1">
                            { for (1..num_blank_days).map(|_| html! {
                                <div class="border border-transparent h-9 p-1 text-center text-md"/>
                            }) }

                            { for (1..=num_days).map(|day| html! {
                                <div
                                    id={day.to_string()}
                                    class="relative h-9 cursor-pointer"
                                    onclick={day_onclick.clone()}
                                >
                                    if incomplete_days.data.as_ref().iter().any(|data| data.contains(&day)) {
                                        <span class="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
                                    }
                                    <div
                                        id={day.to_string()}
                                        class={tw_merge!(
                                            "flex aspect-square w-8 items-center justify-center rounded-full",
                                            day_class(day)
                                        )}
                                    >
                                        { day }
                                    </div>
                                </div>
                            }) }
                        </div>

                        // Footer
                        <div class="mt-2">
                            <a
                                class="cursor-pointer text-base font-bold text-amber-400"
                                onclick={today_onclick}
                            >
                                { "Today" }
                            </a>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    }
}
