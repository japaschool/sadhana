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

    lazy_static! {
        static ref DURATION_R: Regex = Regex::new(r#"(?:(\d+)[^\d]+)?(\d+)[^\d]+"#).unwrap();
    };

    let get_new_val = |input: &HtmlInputElement, entry: &DiaryEntry| match entry.data_type {
        PracticeDataType::Bool => Some(PracticeEntryValue::Bool(input.checked())),
        PracticeDataType::Int => input
            .value()
            .parse()
            .map(|v| PracticeEntryValue::Int(v))
            .ok(),
        PracticeDataType::Text => Some(PracticeEntryValue::Text(input.value())),
        PracticeDataType::Duration => DURATION_R
            .captures_iter(&input.value())
            .filter_map(|cap| {
                cap.get(2).and_then(|m_str| {
                    m_str.as_str().parse().ok().map(|m: u16| {
                        PracticeEntryValue::Duration(
                            m + 60
                                * cap
                                    .get(1)
                                    .and_then(|h_str| h_str.as_str().parse::<u16>().ok())
                                    .unwrap_or_default(),
                        )
                    })
                })
            })
            .next(),
        PracticeDataType::Time => input.value().split_once(":").and_then(|(h, m)| {
            let h = h.parse().ok()?;
            let m = m.parse().ok()?;
            Some(PracticeEntryValue::Time { h, m })
        }),
    };

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
        static ref REJECT_TIME_R: Regex = Regex::new(r"[^\d]").unwrap();
        static ref VALID_DURATION_R: Regex = {
            let h = Locale::current().hours_label();
            let m = Locale::current().minutes_label();
            // There are 3 mutually exclusive regex patterns here.
            // (1) 3 digits representing minutes. No hours are allowed.
            // (2) Number up to 23 for hours only when no minutes are entered.
            // (3) Number between 0 and 23 for hours when minutes are also present.
            // (4) Optional separator between hours and minutes.
            // (5) 2 digits for minutes in presence of hours. Limited to the number 59.
            //
            //                  |------1-----|     |---------2--------|               |---------3--------||-----4-----| |-----5-----|
            let r = format!(r#"^(?:(\d{{1,3}}){m}?|([0-1]?[0-9]|2[0-3])(?:{h}?\s?|:)?|([0-1]?[0-9]|2[0-3])(?:{h}?\s?|:)?([0-5]?[0-9]){m}?)$"#);
            Regex::new(&r).unwrap()
        };
    };

    // use_mut_ref is to avoid re-rendering on every key press
    let backspace_key_pressed = use_mut_ref(|| false);

    let format_duration = |input: &mut HtmlInputElement| {
        let input_value = input.value();

        if input_value.is_empty() {
            return;
        }

        VALID_DURATION_R
            .captures_iter(&input.value())
            .for_each(|cap| {
                let (hours, minutes) = match (cap.get(1), cap.get(2), cap.get(3), cap.get(4)) {
                    (Some(minutes_only), _, _, _) => {
                        let mins = minutes_only.as_str().parse::<u32>().unwrap();
                        ((mins / 60).to_string(), (mins % 60).to_string())
                    }
                    (_, Some(hours_only), _, _) => (hours_only.as_str().to_owned(), "0".into()),
                    (_, _, Some(hours), Some(minutes)) => {
                        (hours.as_str().to_owned(), minutes.as_str().to_owned())
                    }
                    _ => unreachable!(),
                };
                let hours_str = if hours == "0" {
                    String::new()
                } else {
                    format!("{}{}", hours, Locale::current().hours_label(),)
                };
                input.set_value(&format!(
                    "{}{}{}",
                    hours_str,
                    minutes,
                    Locale::current().minutes_label()
                ));
            });
    };

    let oninput_duration = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();

            if *back.borrow() {
                return;
            }

            let idx = input.selection_start().unwrap().unwrap();
            let mut s = input.value();

            // Remove any invalid characters
            while !VALID_DURATION_R.is_match(&s) {
                let mut new_s = String::with_capacity(s.len());
                let mut i = 0;
                for ch in s.chars() {
                    i += 1;
                    if idx != i {
                        new_s.push(ch);
                    }
                }

                let stop = s == new_s;

                s = new_s;

                if stop {
                    break;
                }
            }
            input.set_value(&s);
        })
    };

    let format_time = |input: &mut HtmlInputElement, back: bool| {
        let sel_start = input.selection_start().unwrap().unwrap();
        let sel_end = input.selection_end().unwrap().unwrap();
        let input_value = input.value();

        // Remove anything but digits
        let mut sanitized = REJECT_TIME_R.replace_all(&input_value, "").to_string();

        // Inject zeroes in the relevant places
        if sanitized.len() == 1 && sanitized.parse::<u32>().unwrap() > 2 {
            sanitized.insert(0, '0');
        } else if sanitized.len() == 2 && sanitized.parse::<u32>().unwrap() > 24 {
            sanitized.remove(1);
        } else if sanitized.len() == 3
            && sanitized.chars().nth(2).unwrap().to_digit(10).unwrap() > 5
        {
            sanitized.insert(2, '0');
        }

        let mut sanitized_iter = sanitized.chars();
        let mut next_input_char = sanitized_iter.next();
        let mut res = String::with_capacity(TIME_PATTERN.len());

        // overlay the time pattern over the user input
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

        // Derive the new cursor position
        let [new_start, new_end] = [sel_start, sel_end].map(|i| {
            if back {
                res.char_indices()
                    .rev()
                    .skip(TIME_PATTERN.len() - i as usize)
                    .find_map(|(idx, c)| if c == ':' { None } else { Some(idx + 1) })
                    .unwrap_or(0)
            } else {
                res.char_indices()
                    .skip(sanitized.len())
                    .find_map(|(idx, c)| if c == '-' { Some(idx) } else { None })
                    .unwrap_or(TIME_PATTERN.len())
            }
        });

        // Update the input
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

    let onkeydown_time_dur = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: KeyboardEvent| {
            *back.borrow_mut() = e.key() == "Backspace";
        })
    };

    const TIME_PATTERN: &'static str = "--:--";

    let onfocus_time = {
        Callback::from(move |e: FocusEvent| {
            let mut input: HtmlInputElement = e.target_unchecked_into();
            format_time(&mut input, false);
        })
    };

    let onblur_time_dur = |for_time: bool| {
        let change_buffer = local_diary_entry.clone();
        let ref_diary_entry = static_diary_entry.clone();
        let save_diary_day = save_diary_day.clone();
        Callback::from(move |e: FocusEvent| {
            let mut input: HtmlInputElement = e.target_unchecked_into();
            if for_time {
                if input.value() == TIME_PATTERN {
                    input.set_value("");
                }
            } else {
                format_duration(&mut input)
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

    let onblur_duration = onblur_time_dur(false);
    let onblur_time = onblur_time_dur(true);

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

    const HOVER_TODAY_DATE_DIV_CSS: &'static str = "flex group dark:hover:bg-amber-400 rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const HOVER_DATE_DIV_CSS: &'static str = "flex group hover:bg-zinc-300 dark:hover:bg-slate-800 rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const SELECTED_TODAY_DATE_DIV_CSS: &'static str = "flex group text-white bg-amber-400 rounded-full mt-2 mx-1 cursor-pointer justify-center h-9 w-9";
    const SELECTED_DATE_DIV_CSS: &'static str = "flex group text-white rounded-full border-2 border-amber-400 mt-2 mx-1 cursor-pointer justify-center h-9 w-9";

    let calendar_day = |for_selected_date: bool, d: &NaiveDate| -> Html {
        let date_css = match (for_selected_date, *d == today) {
            (true, true) => SELECTED_TODAY_DATE_DIV_CSS,
            (true, false) => SELECTED_DATE_DIV_CSS,
            (false, true) => HOVER_TODAY_DATE_DIV_CSS,
            (false, false) => HOVER_DATE_DIV_CSS,
        };
        let weekday_label_css = if for_selected_date {
            "text-zinc-500  dark:text-zinc-100 text-base font-semibold"
        } else {
            "text-zinc-500  dark:text-zinc-100 text-base"
        };
        let date_label_css = if for_selected_date {
            "text-zinc-500  dark:text-zinc-100 my-auto font-bold"
        } else {
            "text-zinc-500  dark:text-zinc-100 dark:group-hover:text-white group-hover:text-zinc-100 my-auto group-hover:font-bold transition-all duration-300"
        };

        let id = d.format(DATE_FORMAT);

        html! {
            <div class="text-center">
                <p class={ weekday_label_css }>{ &Locale::current().day_of_week(d).chars().nth(0).unwrap() }</p>
                <div class={ date_css } id={ id.to_string() } onclick={ onclick_date.clone() }>
                    <p id={ id.to_string() } class={ date_label_css }>{ d.format("%-d") }</p>
                </div>
            </div>
        }
    };

    let calendar = html! {
        <div class="relative">
            <div class="flex justify-center overflow-x-scroll mx-auto">
                <div class="flex text-zinc-500 dark:text-zinc-100 group w-16" onclick={ prev_week_onclick.clone() }>
                    <div class="flex items-center"><i class="fas fa-chevron-left"></i></div>
                </div>
                {
                    week.iter().map(|d| html! {
                        <div class="flex group justify-center w-16">
                            <div class="flex items-center">{ calendar_day(*d == *selected_date, d) }</div>
                        </div>
                    }).collect::<Html>()
                }
                <div class="flex text-zinc-500 dark:text-zinc-100 justify-end group w-16" onclick={ next_week_onclick.clone() }>
                    <div class="flex items-center"><i class="fas fa-chevron-right"></i></div>
                </div>
            </div>
        </div>
    };

    html! {
        <BlankPage show_footer=true >
            <ListErrors error={diary_entry.error.clone()} />
            <ListErrors error={save_diary_day.error.clone()} />
            { calendar }
            <div class={ BODY_DIV_CSS }>
            {
                for local_diary_entry.current().iter().enumerate().map(|(idx, DiaryEntry {practice, data_type, value})|
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
                                        <i class="icon-rounds icon"></i>{ format!(" {}: ", practice) }
                                    </label>
                                </div>
                                },
                            PracticeDataType::Bool => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <label class="flex justify-between whitespace-nowrap">
                                        <span class=""><i class="icon-tick icon"></i>{ format!(" {}: ", practice) }</span>
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
                            PracticeDataType::Duration => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <input
                                        autocomplete="off"
                                        id={ idx.to_string() }
                                        type="text"
                                        pattern="[0-9]*"
                                        onblur={ onblur_duration.clone() }
                                        oninput={ oninput_duration.clone() }
                                        onkeydown={ onkeydown_time_dur.clone() }
                                        value={ value.iter().find_map(|v| v.as_duration_str()).unwrap_or_default() }
                                        class={ format!("{} text-center", INPUT_CSS) }
                                        placeholder={ idx.to_string() }
                                        />
                                    <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                        <i class="icon-clock icon"></i>
                                        { format!(" {}: ", practice) }
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
                                        onblur={ onblur_time.clone() }
                                        onfocus={ onfocus_time.clone() }
                                        oninput={ oninput_time.clone() }
                                        onkeydown={ onkeydown_time_dur.clone() }
                                        value={ value.iter().find_map(|v| v.as_time_str()).unwrap_or_default() }
                                        class={ format!("{} text-center", INPUT_CSS) }
                                        placeholder={ idx.to_string() }
                                        />
                                    <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                        <i class="icon-clock icon"></i>
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
                                    <i class="icon-doc icon"></i>
                                                                            { format!(" {}: ", practice) }
                                                                     </label>
                                                                  </div>
                                                               }
                                                     }}
                                                  )
                                             }
                                                  <div class="relative flex justify-center links">
                                                     <Link<AppRoute> classes={ LINK_CSS_NEW_ACC } to={AppRoute::UserPractices}>
                                                        { Locale::current().modify_practices() }
                    </Link<AppRoute>>
                </div>
            </div>
        </BlankPage>
    }
}
