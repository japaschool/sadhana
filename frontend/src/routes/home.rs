use chrono::{prelude::*, Days};
use lazy_static::lazy_static;
use regex::Regex;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_list};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{DiaryDay, DiaryEntry, PracticeDataType, PracticeEntryValue},
    services::{get_diary_day, save_diary},
};

use super::AppRoute;

#[function_component(Home)]
pub fn home() -> Html {
    let today = Local::now().date_naive();
    let selected_date = use_state(|| Local::now().date_naive());
    let week = use_state(|| vec![Local::now().date_naive()]);

    {
        let week = week.clone();
        use_effect_with_deps(
            move |d| {
                let d = d.week(Weekday::Mon).first_day();
                let mut res = vec![d.clone()];
                for i in 1..7 {
                    res.push(d.clone().checked_add_days(Days::new(i)).unwrap());
                }
                week.set(res);
                || ()
            },
            selected_date.clone(),
        );
    }

    // A copy of backend data with local changes
    let local_diary_entry = use_list(Vec::new());
    // A copy of the backend state without local values changes.
    // Used as reference for getting indexes and data types of entries to avoid
    // immutable borrowing of the local change buffer.
    let static_diary_entry = use_state(|| Vec::new());
    let diary_entry = {
        let selected_date = selected_date.clone();
        use_async(async move { get_diary_day(&*selected_date).await.map(|je| je.diary_day) })
    };
    let save_diary_day = {
        let local = local_diary_entry.clone();
        let cob = selected_date.clone();
        use_async(async move {
            let diary_day = local.current().to_owned();
            save_diary(DiaryDay {
                diary_day,
                cob_date: *cob,
            })
            .await
        })
    };

    {
        // Fetch data from server on date change
        let diary_entry = diary_entry.clone();
        use_effect_with_deps(
            move |_| {
                diary_entry.run();
                || ()
            },
            selected_date.clone(),
        );
    }

    {
        // Update local state from server data when the later changes
        let local = local_diary_entry.clone();
        let local2 = static_diary_entry.clone();
        use_effect_with_deps(
            move |je| {
                je.data.iter().for_each(|data| {
                    local.set(data.clone());
                    local2.set(data.clone());
                });
                || ()
            },
            diary_entry.clone(),
        );
    }

    const DATE_FORMAT: &'static str = "%Y-%m-%d";

    let onclick_date = {
        let selected_date = selected_date.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let new_date = NaiveDate::parse_from_str(input.id().as_str(), DATE_FORMAT).unwrap();
            selected_date.set(new_date);
        })
    };

    fn get_new_val(input: &HtmlInputElement, entry: &DiaryEntry) -> Option<PracticeEntryValue> {
        match entry.data_type {
            PracticeDataType::Bool => Some(PracticeEntryValue::Bool(input.checked())),
            PracticeDataType::Int => input
                .value()
                .parse()
                .map(|v| PracticeEntryValue::Int(v))
                .ok(),
            PracticeDataType::Text => Some(PracticeEntryValue::Text(input.value())),
            PracticeDataType::Time => input.value().split_once(":").and_then(|(h, m)| {
                let h = h.parse().ok()?;
                let m = m.parse().ok()?;
                Some(PracticeEntryValue::Time { h, m })
            }),
        }
    }

    let checkbox_onclick = {
        let change_buffer = local_diary_entry.clone();
        let ref_diary_entry = static_diary_entry.clone();
        let save_diary_day = save_diary_day.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut current = ref_diary_entry[idx].clone();
            let new_val = get_new_val(&input, &current);

            current.value = new_val;
            change_buffer.update(idx, current);
            save_diary_day.run();
        })
    };

    let onchange = {
        let change_buffer = local_diary_entry.clone();
        let ref_diary_entry = static_diary_entry.clone();
        let save_diary_day = save_diary_day.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut current = ref_diary_entry[idx].clone();
            let new_val = get_new_val(&input, &current);

            current.value = new_val;
            change_buffer.update(idx, current);
            save_diary_day.run();
        })
    };

    lazy_static! {
        static ref REJECT: Regex = Regex::new(r"[^\d]").unwrap();
    };

    let backspace_key_pressed = use_mut_ref(|| false);

    let format_time = |input: &mut HtmlInputElement, back: bool| {
        let sel_start = input.selection_start().unwrap().unwrap();
        let sel_end = input.selection_end().unwrap().unwrap();
        let input_value = input.value();

        let sanitized = REJECT.replace_all(&input_value, "");

        let mut sanitized_iter = sanitized.chars();
        let mut next_input_char = sanitized_iter.next();
        let mut res = String::with_capacity(TIME_PATTERN.len());

        for c in TIME_PATTERN.chars() {
            let x = next_input_char
                .map(|i| {
                    if c == i || c == '-' {
                        next_input_char = sanitized_iter.next();
                        i
                    } else {
                        c
                    }
                })
                .unwrap_or(c);
            res.push(x);
        }

        let [new_start, new_end] = [sel_start, sel_end].map(|i| {
            if back {
                res.char_indices()
                    .rev()
                    .skip(TIME_PATTERN.len() - i as usize)
                    .find_map(|(idx, c)| if c == ':' { None } else { Some(idx + 1) })
                    .unwrap_or(0)
            } else {
                res.char_indices()
                    .skip(i as usize)
                    .find_map(|(idx, c)| if c == '-' { Some(idx) } else { None })
                    .unwrap_or(TIME_PATTERN.len())
            }
        });

        input.set_value(res.as_str());
        let _ = input.set_selection_start(Some(new_start as u32));
        let _ = input.set_selection_end(Some(new_end as u32));
    };

    let oninput_time = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: InputEvent| {
            let mut input: HtmlInputElement = e.target_unchecked_into();
            format_time(&mut input, *back.borrow());
        })
    };

    let onkeydown_time = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: KeyboardEvent| {
            *back.borrow_mut() = e.key() == "Backspace";
        })
    };

    let onblur_time = {
        let change_buffer = local_diary_entry.clone();
        let ref_diary_entry = static_diary_entry.clone();
        let save_diary_day = save_diary_day.clone();
        Callback::from(move |e: FocusEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            if input.value() == TIME_PATTERN {
                input.set_value("");
            }

            // Safari does not seem to fire onchange when there is oninput: https://developer.apple.com/forums/thread/698078
            // Hence have to update state on blur
            let idx: usize = input.id().parse().unwrap();
            let mut current = ref_diary_entry[idx].clone();
            let new_val = get_new_val(&input, &current);

            current.value = new_val;
            change_buffer.update(idx, current);
            save_diary_day.run();
        })
    };

    const TIME_PATTERN: &'static str = "--:--";

    let onfocus_time = {
        Callback::from(move |e: FocusEvent| {
            let mut input: HtmlInputElement = e.target_unchecked_into();
            format_time(&mut input, false);
        })
    };

    let next_week_onclick = {
        let selected_date = selected_date.clone();
        Callback::from(move |_: MouseEvent| {
            selected_date.set(selected_date.checked_add_days(Days::new(7)).unwrap());
        })
    };

    let prev_week_onclick = {
        let selected_date = selected_date.clone();
        Callback::from(move |_: MouseEvent| {
            selected_date.set(selected_date.checked_sub_days(Days::new(7)).unwrap());
        })
    };

    const HOVER_TODAY_DATE_DIV_CSS: &'static str = "flex group hover:bg-red-500 hover:shadow-lg hover-dark-shadow rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const HOVER_DATE_DIV_CSS: &'static str = "flex group hover:bg-slate-800 hover:shadow-lg hover-dark-shadow rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const SELECTED_TODAY_DATE_DIV_CSS: &'static str = "flex group bg-red-500 shadow-lg dark-shadow rounded-full mt-2 mx-1 cursor-pointer justify-center h-9 w-9";
    const SELECTED_DATE_DIV_CSS: &'static str = "flex group bg-slate-800 shadow-lg dark-shadow rounded-full mt-2 mx-1 cursor-pointer justify-center h-9 w-9";

    let calendar_day = |for_selected_date: bool, d: &NaiveDate| -> Html {
        let date_css = match (for_selected_date, *d == today) {
            (true, true) => SELECTED_TODAY_DATE_DIV_CSS,
            (true, false) => SELECTED_DATE_DIV_CSS,
            (false, true) => HOVER_TODAY_DATE_DIV_CSS,
            (false, false) => HOVER_DATE_DIV_CSS,
        };
        let weekday_label_css = if for_selected_date {
            "text-white text-sm font-semibold"
        } else {
            "text-white text-sm"
        };
        let date_label_css = if for_selected_date {
            "text-white my-auto font-bold"
        } else {
            "text-white group-hover:text-gray-100 my-auto group-hover:font-bold transition-all duration-300"
        };

        let id = d.format(DATE_FORMAT);

        html! {
            <div class="text-center">
                <p class={ weekday_label_css }>{ &Locale::current().day_of_week(d)[0..1] }</p>
                <div class={ date_css } id={ id.to_string() } onclick={ onclick_date.clone() }>
                    <p id={ id.to_string() } class={ date_label_css }>{ d.format("%-d") }</p>
                </div>
            </div>
        }
    };

    let calendar = html! {
        <div class="relative mt-4 py-2">
            <div class="flex justify-center overflow-x-scroll mx-auto">
                <div class="flex text-white group w-16" onclick={ prev_week_onclick.clone() }>
                    <div class="flex items-center"><i class="fa-solid fa-chevron-left"></i></div>
                </div>
                {
                    week.iter().map(|d| html! {
                        <div class="flex group justify-center w-16">
                            <div class="flex items-center">{ calendar_day(*d == *selected_date, d) }</div>
                        </div>
                    }).collect::<Html>()
                }
                <div class="flex text-white justify-end group w-16" onclick={ next_week_onclick.clone() }>
                    <div class="flex items-center"><i class="fa-solid fa-chevron-right"></i></div>
                </div>
            </div>
        </div>
    };

    html! {
        <BlankPage>
            <ListErrors error={diary_entry.error.clone()} />
            <ListErrors error={save_diary_day.error.clone()} />
            { calendar }
            <div class={ BODY_DIV_CSS }>
            {
                for local_diary_entry.current().iter().enumerate().map(|(idx, DiaryEntry {practice, data_type, value})| {
                    html! {
                        match data_type {
                            PracticeDataType::Int => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <input
                                        onchange={ onchange.clone() }
                                        type="number"
                                        pattern="[0-9]*"
                                        id={ idx.to_string() }
                                        value={ value.iter().find_map(|v| v.as_int().map(|i| i.to_string())).unwrap_or_default() }
                                        min="0"
                                        max="174"
                                        placeholder={ idx.to_string() }
                                        class={ format!("{} text-center", INPUT_CSS) }
                                        />
                                    <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                        <i class="fa fa-input-numeric"></i>{ format!(" {}: ", practice) }
                                    </label>
                                </div>
                                },
                            PracticeDataType::Bool => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <label class="flex justify-between whitespace-nowrap">
                                        <span class=""><i class="fa"></i>{ format!(" {}: ", practice) }</span>
                                        <input
                                            id="checkbox"
                                            type="checkbox"
                                            onclick={ checkbox_onclick.clone() }
                                            id={ idx.to_string() }
                                            checked={ value.iter().find_map(|v| v.as_bool()).unwrap_or(false) }
                                            />
                                    </label>
                                </div>
                                },
                            PracticeDataType::Time => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <input
                                        autocomplete="off"
                                        id={ idx.to_string() }
                                        type="text"
                                        pattern="[0-9]*"
                                        onblur={ onblur_time.clone()}
                                        onfocus={ onfocus_time.clone() }
                                        oninput={ oninput_time.clone() }
                                        onkeydown={ onkeydown_time.clone() }
                                        value={ value.iter().find_map(|v| v.as_time_str()).unwrap_or_default() }
                                        class={ INPUT_CSS }
                                        placeholder={ idx.to_string() }
                                        />
                                    <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                        <i class="fa fa-clock"></i>
                                        { format!(" {}: ", practice) }
                                    </label>
                                </div>
                                },
                            PracticeDataType::Text => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <textarea
                                        id={ idx.to_string() }
                                        class={ TEXTAREA_CSS }
                                        maxlength="1024"
                                        rows="4"
                                        placeholder={ idx.to_string() }
                                        onchange={ onchange.clone() }
                                        value={ value.iter().find_map(|v| v.as_text()).unwrap_or_default() }
                                        >
                                    </textarea>
                                    <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                        <i class="fa"></i>
                                        { format!(" {}: ", practice) }
                                    </label>
                                </div>
                            }
                    }}
                })
            }
                <div class="relative flex justify-center">
                    <Link<AppRoute> classes={ LINK_CSS } to={AppRoute::UserPractices}>
                        { Locale::current().modify_practices() }
                    </Link<AppRoute>>
                </div>
            </div>
        </BlankPage>
    }
}
