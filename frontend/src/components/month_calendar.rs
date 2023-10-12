use std::rc::Rc;

use super::calendar::{
    HOVER_DATE_COLOR_CSS, HOVER_TODAY_DATE_COLOR_CSS, SELECTED_TODAY_DATE_COLOR_CSS,
};
use chrono::{Datelike, Local, Months, NaiveDate};
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::i18n::{Locale, DAYS};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub selected_date: NaiveDate,
    pub date_onchange: Callback<NaiveDate>,
    pub close: Callback<()>,
    #[prop_or_default]
    pub highlight_date: Option<Callback<Rc<NaiveDate>, bool>>, //TODO:
}

const DAY_CSS: &'static str = "cursor-pointer text-center text-sm rounded-full leading-loose transition-all ease-in-out duration-300";

#[function_component(MonthCalendar)]
pub fn month_calendar(props: &Props) -> Html {
    let today: NaiveDate = Local::now().date_naive();
    let month_start = use_state(|| {
        NaiveDate::from_ymd_opt(props.selected_date.year(), props.selected_date.month(), 1).unwrap()
    });
    let num_blank_days = month_start.weekday().number_from_monday();
    let next_month_start = month_start.checked_add_months(Months::new(1)).unwrap();
    let num_days = next_month_start
        .signed_duration_since(*month_start)
        .num_days();

    let is_today = |day| {
        today.day() as i64 == day
            && month_start.month() == today.month()
            && month_start.year() == today.year()
    };
    let is_selected = |day| props.selected_date.day() as i64 == day;

    let day_class = |day| {
        let color_css = match (is_selected(day), is_today(day)) {
            (true, true) => SELECTED_TODAY_DATE_COLOR_CSS,
            (true, false) => "shadow-inset-amber-400",
            (false, true) => HOVER_TODAY_DATE_COLOR_CSS,
            (false, false) => HOVER_DATE_COLOR_CSS,
        };
        format!("text-zinc-500 dark:text-zinc-100 {DAY_CSS} {color_css}")
    };

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
        Callback::from(move |_| {
            close.emit(());
        })
    };

    let day_onclick = {
        let parent_cb = props.date_onchange.clone();
        let month_start = month_start.clone();
        let close = props.close.clone();
        Callback::from(move |e: MouseEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let day: u32 = input.id().parse().unwrap();
            let selected_date =
                NaiveDate::from_ymd_opt(month_start.year(), month_start.month(), day).unwrap();
            parent_cb.emit(selected_date);
            close.emit(());
        })
    };

    html! {
        <div
            class={"fixed left-0 top-0 flex w-full h-full items-center justify-center z-10 antialiased sans-serif"}
            >
            <div class="fixed top-0 bottom-0 left-0 right-0 bg-black bg-opacity-30 border-amber-400" onclick={cancel_onclick} />
            <div class="relative">
                <div class="container" >
                    <div
                        class="bg-gradient-to-t from-neutral-300 via-neutral-100 to-white dark:from-zinc-900 dark:via-zinc-700 dark:to-zinc-600 rounded-lg shadow p-4"
                        style="width: 17rem"
                        >
                        <div class="flex justify-between items-center mb-2">
                            <div>
                                <span class="text-lg font-bold text-gray-800 dark:text-white">{Locale::current().month_name(month_start.month())}</span>
                                <span class="ml-1 text-lg text-gray-600 dark:text-white font-normal">{month_start.year()}</span>
                            </div>
                            <div>
                                <button
                                    type="button"
                                    class="transition ease-in-out duration-100 inline-flex cursor-pointer hover:bg-gray-200 p-1 rounded-full"
                                    onclick={prev_month_onclick}
                                    >
                                    <svg class="h-6 w-6 text-gray-500 dark:text-white inline-flex"  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    class="transition ease-in-out duration-100 inline-flex cursor-pointer hover:bg-gray-200 p-1 rounded-full"
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
                                <div style="width: 14.28%" class="text-center border p-1 border-transparent text-sm"/>
                            })}
                            {for (1..=num_days).map(|day| html! {
                                <div id={day.to_string()} style="width: 14.28%" class="px-1 mb-1" onclick={day_onclick.clone()} >
                                    <div id={day.to_string()} class={day_class(day)}>{day}</div>
                                </div>
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}
