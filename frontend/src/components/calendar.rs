use std::collections::HashSet;

use chrono::{Days, prelude::*};
use gloo_events::EventListener;
use tw_merge::*;
use web_sys::{HtmlInputElement, VisibilityState};
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

use crate::{hooks::SessionStateContext, i18n::Locale, services::get_incomplete_days};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or(false)]
    pub highlight_incomplete_dates: bool,
    #[prop_or_default]
    pub selected_date_incomplete: Option<bool>,
}

pub const DATE_FORMAT: &str = "%Y-%m-%d";

const DATE_CSS: &str =
    "flex group rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center";

pub const HOVER_TODAY_DATE_COLOR_CSS: &str =
    "can-hover:hover:bg-amber-400 dark:can-hover:hover:bg-amber-400";
pub const HOVER_DATE_COLOR_CSS: &str =
    "can-hover:hover:bg-zinc-300 dark:can-hover:hover:bg-slate-800";
pub const SELECTED_TODAY_DATE_COLOR_CSS: &str = "bg-amber-400";
pub const SELECTED_DATE_COLOR_CSS: &str = "border-2 border-amber-400";

const OUT_OF_WEEK_DAY_CSS: &str = "opacity-30 scale-80 hover:opacity-70";

#[function_component(Calendar)]
pub fn calendar(props: &Props) -> Html {
    let today = use_state(|| Local::now().date_naive());
    let session_state =
        use_context::<SessionStateContext>().expect("No session state context found");
    let touch_start = use_mut_ref(|| None::<(i32, i32)>);
    let translate_x = use_state(|| 0);
    let is_animating = use_state(|| false);

    let week = {
        let d = session_state.selected_date.week(Weekday::Mon).first_day();
        let mut res = vec![d];
        for i in 1..7 {
            res.push(d.checked_add_days(Days::new(i)).unwrap());
        }
        res
    };

    let prev_week_day = week.first().unwrap().pred_opt().unwrap();
    let next_week_day = week.last().unwrap().succ_opt().unwrap();

    let selected_date_str = titlecase(
        &session_state
            .selected_date
            .format_localized("%A, %e %B %Y", Locale::current().chrono())
            .to_string(),
    );

    let incomplete_days = {
        let enabled = props.highlight_incomplete_dates;
        use_async(async move {
            if enabled {
                get_incomplete_days(&prev_week_day, &next_week_day)
                    .await
                    .map(|res| res.days.iter().map(|d| d.day()).collect::<HashSet<_>>())
            } else {
                Ok(HashSet::default())
            }
        })
    };

    {
        let incomplete_days = incomplete_days.clone();
        let should_run = props.highlight_incomplete_dates;
        use_mount(move || {
            if should_run {
                incomplete_days.run();
            }
        });
    }

    {
        let incomplete_days = incomplete_days.clone();
        use_effect_with(session_state.clone(), move |_| {
            incomplete_days.run();
            || ()
        });
    }

    {
        let today = today.clone();
        use_effect(move || {
            let onwakeup = Callback::from(move |_: Event| {
                if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
                    if doc.visibility_state() == VisibilityState::Visible {
                        today.set(Local::now().date_naive());
                    }
                }
            });

            let listener =
                EventListener::new(&web_sys::window().unwrap(), "visibilitychange", move |e| {
                    onwakeup.emit(e.clone());
                });

            move || drop(listener)
        });
    }

    let is_incomplete_day = |day| {
        if !incomplete_days.loading && session_state.selected_date.day() == day {
            if let Some(selected_date_incomplete) = props.selected_date_incomplete.as_ref() {
                return *selected_date_incomplete;
            }
        }
        incomplete_days
            .data
            .as_ref()
            .iter()
            .any(|data| data.contains(&day))
    };

    let onclick_date = {
        let ss = session_state.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let new_date = NaiveDate::parse_from_str(input.id().as_str(), DATE_FORMAT).unwrap();
            ss.dispatch(new_date);
        })
    };

    let next_week_onclick = {
        let selected_date = session_state.selected_date;
        let ss = session_state.clone();
        Callback::from(move |_: MouseEvent| {
            let new_date = if selected_date.weekday() == Weekday::Sun {
                selected_date.succ_opt().unwrap()
            } else {
                selected_date.checked_add_days(Days::new(7)).unwrap()
            };
            ss.dispatch(new_date);
        })
    };

    let prev_week_onclick = {
        let selected_date = session_state.selected_date;
        let ss = session_state.clone();
        Callback::from(move |_: MouseEvent| {
            let new_date = if selected_date.weekday() == Weekday::Mon {
                selected_date.pred_opt().unwrap()
            } else {
                selected_date.checked_sub_days(Days::new(7)).unwrap()
            };
            ss.dispatch(new_date);
        })
    };

    let ontouchstart = {
        let touch_start = touch_start.clone();
        let is_animating = is_animating.clone();
        Callback::from(move |e: TouchEvent| {
            if let Some(touch) = e.touches().get(0) {
                *touch_start.borrow_mut() = Some((touch.client_x(), touch.client_y()));
                is_animating.set(false);
            }
        })
    };

    let ontouchmove = {
        let touch_start = touch_start.clone();
        let translate_x = translate_x.clone();

        Callback::from(move |e: TouchEvent| {
            let Some((start_x, start_y)) = *touch_start.borrow() else {
                return;
            };
            let Some(touch) = e.touches().get(0) else {
                return;
            };

            let dx = touch.client_x() - start_x;
            let dy = touch.client_y() - start_y;

            // Ignore vertical scroll
            if dx.abs() < dy.abs() {
                return;
            }

            let clamped_dx = dx.clamp(-120, 120);

            translate_x.set(clamped_dx);
        })
    };

    let ontouchend = {
        let touch_start = touch_start.clone();
        let translate_x = translate_x.clone();
        let is_animating = is_animating.clone();

        let prev = prev_week_onclick.clone();
        let next = next_week_onclick.clone();

        Callback::from(move |_| {
            let dx = *translate_x;
            *touch_start.borrow_mut() = None;

            is_animating.set(true);

            if dx > 60 {
                translate_x.set(0);
                prev.emit(MouseEvent::new("click").unwrap());
            } else if dx < -60 {
                translate_x.set(0);
                next.emit(MouseEvent::new("click").unwrap());
            } else {
                // Snap back
                translate_x.set(0);
            }
        })
    };

    let calendar_day = |for_selected_date: bool, is_outside_week: bool, d: &NaiveDate| -> Html {
        let date_css = match (for_selected_date, *d == *today) {
            (true, true) => tw_merge!(SELECTED_TODAY_DATE_COLOR_CSS, "h-9 w-9"),
            (true, false) => tw_merge!(SELECTED_DATE_COLOR_CSS, "h-8 w-8"),
            (false, true) => tw_merge!(HOVER_TODAY_DATE_COLOR_CSS, "h-8 w-8"),
            (false, false) => tw_merge!(HOVER_DATE_COLOR_CSS, "h-8 w-8"),
        };

        let weekday_label_css = if for_selected_date {
            "text-xs font-semibold text-zinc-600 dark:text-zinc-100".to_string()
        } else {
            "text-xs text-zinc-500 dark:text-zinc-400".to_string()
        };

        let date_label_css = if for_selected_date {
            "text-zinc-500 dark:text-zinc-100 my-auto font-bold".into()
        } else {
            tw_merge!(
                if *d == *today {
                    "text-amber-400"
                } else {
                    "text-zinc-500 dark:text-zinc-100"
                },
                "dark:can-hover:group-hover:text-white can-hover:group-hover:text-zinc-100 my-auto can-hover:group-hover:font-bold transition-all duration-300"
            )
        };

        let id = d.format(DATE_FORMAT);

        html! {
            <div class="relative flex flex-col items-center gap-1 text-center">
                <p class={weekday_label_css}>
                    { Locale::current().day_of_week(d).chars().next().unwrap() }
                </p>
                <div class="relative h-9 w-9 flex items-center justify-center">
                    <div
                        id={id.to_string()}
                        class={tw_merge!(
                            DATE_CSS,
                            "aspect-square w-8 flex items-center justify-center relative",
                            date_css,
                            if is_outside_week { OUT_OF_WEEK_DAY_CSS } else { "" }
                        )}
                        onclick={if is_outside_week {
                                if *d < *week.first().unwrap() {
                                    prev_week_onclick.clone()
                                } else {
                                    next_week_onclick.clone()
                                }
                            } else {
                                onclick_date.clone()
                            }}
                    >
                        <p class={tw_merge!(date_label_css, "pointer-events-none")}>
                            { d.format("%-d").to_string() }
                        </p>
                    </div>
                    if is_incomplete_day(d.day()) {
                        <span
                            class="pointer-events-none absolute top-2 right-1 h-2 w-2 rounded-full bg-red-500"
                        />
                    }
                </div>
            </div>
        }
    };

    html! {
        <div
            class={tw_merge!(
                "overflow-hidden select-none touch-pan-y",
                if *is_animating {
                    "transition-transform duration-300 ease-out"
                } else {
                    ""
                }
            )}
            ontouchstart={ontouchstart}
            ontouchmove={ontouchmove}
            ontouchend={ontouchend}
        >
            <div class="mx-auto max-w-sm">
                <div
                    class="grid grid-cols-9 items-center text-zinc-500 dark:text-zinc-100"
                    style={format!("transform: translateX({}px);", *translate_x)}
                >
                    // Last day of previous week
                    <div class="flex justify-center">
                        { calendar_day(false, true, &prev_week_day) }
                    </div>
                    // Current week
                    { for week.iter().map(|d| html! {
                        <div class="flex justify-center pointer-events-none">
                            <div class="pointer-events-auto">
                                { calendar_day(*d == session_state.selected_date, false, d) }
                            </div>
                        </div>
                    }) }
                    // First day of next week
                    <div class="flex justify-center">
                        { calendar_day(false, true, &next_week_day) }
                    </div>
                </div>
            </div>
            <div class="mt-1 flex justify-center">
                <p class="text-sm text-zinc-500 dark:text-zinc-100">{ selected_date_str }</p>
            </div>
        </div>
    }
}

fn titlecase(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let mut c = word.chars();
            match c.next() {
                None => String::new(),
                Some(first_char) => first_char.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
