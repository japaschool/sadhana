use std::rc::Rc;

use chrono::prelude::*;
use gloo_events::EventListener;
use lazy_static::lazy_static;
use regex::Regex;
use wasm_bindgen::JsCast;
use web_sys::{HtmlElement, HtmlInputElement, VisibilityState};
use yew::prelude::*;
use yew_hooks::{use_async, use_list};

use crate::{
    components::{
        blank_page::{BlankPage, ButtonType, CalendarProps, HeaderButtonProps},
        list_errors::ListErrors,
        prompt::Prompt,
    },
    css::*,
    i18n::{Locale, PracticeName},
    model::{DiaryEntry, PracticeDataType, PracticeEntryValue},
    services::{get_diary_day, get_incomplete_days, save_diary_entry},
};

use super::AppRoute;

lazy_static! {
    static ref DURATION_R: Regex = Regex::new(r"(?:(\d+)[^\d]+)?(\d+)[^\d]+").unwrap();
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
}

#[function_component(Home)]
pub fn home() -> Html {
    let selected_date = use_state(|| Local::now().date_naive());

    // A copy of backend data with local changes
    let local_diary_entry = use_list(Vec::new());
    let current_entry = use_state(|| None::<DiaryEntry>);

    let add_duration_prompt_idx = use_state(|| None::<usize>);

    let diary_entry = {
        let selected_date = selected_date.clone();
        use_async(async move { get_diary_day(&selected_date).await.map(|je| je.diary_day) })
    };

    let incomplete_days = {
        let selected = selected_date.clone();
        use_async(async move { get_incomplete_days(&selected).await.map(|res| res.days) })
    };

    let save_diary_day_entry = {
        let cob = selected_date.clone();
        let entry = current_entry.clone();
        let incomplete_days = incomplete_days.clone();
        use_async(async move {
            if let Some(e) = entry.as_ref() {
                save_diary_entry(&cob, e).await.map(|_| {
                    entry.set(None);
                    if incomplete_days
                        .data
                        .as_ref()
                        .unwrap_or(&vec![])
                        .contains(&*cob)
                        || e.value.is_none()
                    {
                        incomplete_days.run();
                    }
                })
            } else {
                Ok(())
            }
        })
    };

    {
        // Reload the home screen if the browser window was inactive.
        // Mostly needed to refresh the app on a phone after it was minimized to
        // pick up any concurrent changes
        let diary_entry = diary_entry.clone();
        let incomplete_days = incomplete_days.clone();
        use_effect(move || {
            let onwakeup = Callback::from(move |_: Event| {
                if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
                    if doc.visibility_state() == VisibilityState::Visible {
                        diary_entry.run();
                        incomplete_days.run();
                    } else {
                        // Blur active element when app minimised so its data is saved
                        if let Some(e) = doc
                            .active_element()
                            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
                        {
                            e.blur().unwrap();
                        }
                    }
                }
            });

            // Create a Closure from a Box<dyn Fn> - this has to be 'static
            let listener =
                EventListener::new(&web_sys::window().unwrap(), "visibilitychange", move |e| {
                    onwakeup.emit(e.clone());
                });

            move || drop(listener)
        });
    }

    {
        // Fetch data from server on date change
        let diary_entry = diary_entry.clone();
        let incomplete_days = incomplete_days.clone();
        use_effect_with(selected_date.clone(), move |_| {
            diary_entry.run();
            incomplete_days.run();
            || ()
        });
    }

    {
        // Update local state from server data when the later changes
        let local = local_diary_entry.clone();
        use_effect_with(diary_entry.clone(), move |je| {
            je.data.iter().for_each(|data| {
                local.set(data.clone());
            });
            || ()
        });
    }

    let get_new_val = |input: &HtmlInputElement, entry: &DiaryEntry| {
        let s = match entry.data_type {
            PracticeDataType::Bool => input.checked().to_string(),
            _ => input.value(),
        };
        if s.is_empty() {
            None
        } else {
            PracticeEntryValue::try_from((&entry.data_type, s.as_str())).ok()
        }
    };

    let checkbox_onclick = {
        let local_state = local_diary_entry.clone();
        let save = save_diary_day_entry.clone();
        let save_buffer = current_entry.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut entry = local_state.current()[idx].clone();
            let new_val = get_new_val(&input, &entry);

            entry.value = new_val;
            local_state.update(idx, entry.clone());
            save_buffer.set(Some(entry));
            save.run();
        })
    };

    let onchange = {
        let local_state = local_diary_entry.clone();
        let save = save_diary_day_entry.clone();
        let save_buffer = current_entry.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut entry = local_state.current()[idx].clone();
            let new_val = get_new_val(&input, &entry);

            if entry.value != new_val {
                entry.value = new_val;
                local_state.update(idx, entry.clone());
                save_buffer.set(Some(entry));
                save.run();
            }
        })
    };

    // use_mut_ref is to avoid re-rendering on every key press
    let backspace_key_pressed = use_mut_ref(|| false);

    let format_duration = |input: &mut HtmlInputElement| {
        let input_value = input.value();

        if input_value.is_empty() {
            return;
        }

        VALID_DURATION_R
            .captures_iter(&input_value)
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
        } else if sanitized.len() == 2 && sanitized.parse::<u32>().unwrap() > 23 {
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

    const TIME_PATTERN: &str = "--:--";

    let onfocus_time = {
        Callback::from(move |e: FocusEvent| {
            let mut input: HtmlInputElement = e.target_unchecked_into();
            format_time(&mut input, false);
        })
    };

    let onblur_time_dur = |for_time: bool| {
        let local_state = local_diary_entry.clone();
        let save = save_diary_day_entry.clone();
        let save_buffer = current_entry.clone();
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
            let mut entry = local_state.current()[idx].clone();
            let new_val = get_new_val(&input, &entry);

            if entry.value != new_val {
                entry.value = new_val;
                local_state.update(idx, entry.clone());
                save_buffer.set(Some(entry));
                save.run();
            }
        })
    };

    let onblur_duration = onblur_time_dur(false);
    let onblur_time = onblur_time_dur(true);

    let selected_date_onchange = {
        let selected = selected_date.clone();
        Callback::from(move |new_date: NaiveDate| {
            selected.set(new_date);
        })
    };

    let cal_should_highlight = {
        let today = Local::now().date_naive();
        let incomplete_days = incomplete_days.clone();
        Callback::from(move |date: Rc<NaiveDate>| -> bool {
            today > *date
                && incomplete_days
                    .data
                    .iter()
                    .any(|inner| inner.contains(date.as_ref()))
        })
    };

    let add_duration_onclick = {
        let idx = add_duration_prompt_idx.clone();
        Callback::from(move |e: MouseEvent| {
            if (*idx).is_some() {
                idx.set(None);
            } else {
                let el: HtmlElement = e.target_unchecked_into();
                idx.set(el.id().parse().ok());
            }
        })
    };

    let calendar_props = CalendarProps::new(
        *selected_date,
        selected_date_onchange.clone(),
        cal_should_highlight,
        true,
    );

    let edit_practices_button = HeaderButtonProps::new_redirect(
        Locale::current().practices(),
        AppRoute::UserPractices,
        None,
        ButtonType::Button,
    );

    let add_duraction = {
        let idx = add_duration_prompt_idx.clone();
        let local_state = local_diary_entry.clone();
        let save = save_diary_day_entry.clone();
        let save_buffer = current_entry.clone();
        Callback::from(move |value: String| {
            log::debug!("Add duration {}", value.to_string());

            if let Ok(add_minutes) = value.parse::<u16>() {
                if let Some(idx) = *idx {
                    let mut entry = local_state.current()[idx].clone();
                    if let Some(PracticeEntryValue::Duration(minutes)) = entry.value {
                        if add_minutes > 0 {
                            entry.value = Some(PracticeEntryValue::Duration(minutes + add_minutes));
                            local_state.update(idx, entry.clone());
                            save_buffer.set(Some(entry));
                            save.run();
                        }
                    }
                }
            }
            idx.set(None);
        })
    };

    html! {
        <BlankPage
            right_button={edit_practices_button}
            show_footer=true
            loading={diary_entry.loading}
            selected_page={AppRoute::Home}
            calendar={calendar_props}
            >
            if let Some(idx) = *add_duration_prompt_idx {
            <Prompt
                title={Locale::current().prompt_title_add_dur(PracticeName(&local_diary_entry.current()[idx].practice))}
                description={Locale::current().prompt_desc_add_dur(PracticeName(&local_diary_entry.current()[idx].practice))}
                onsuccess={add_duraction.clone()}
                oncancel={add_duration_onclick.clone()}
                />
            }
            <ListErrors error={diary_entry.error.clone()} />
            <ListErrors error={save_diary_day_entry.error.clone()} />
            <div class={BODY_DIV_SPACE_10_CSS}>
                <div class={TWO_COLS_CSS}>
                    {for local_diary_entry.current().iter().enumerate().map(|(idx, DiaryEntry {practice, data_type, value})|
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
                                            <i class="icon-rounds"></i>{ format!(" {}: ", practice) }
                                        </label>
                                    </div>
                                    },
                                PracticeDataType::Bool => html! {
                                    <div class="relative" key={ practice.clone() } >
                                        <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                            <span class=""><i class="icon-tick"></i>{ format!(" {}: ", practice) }</span>
                                            <div class="flex">
                                                <input
                                                type="checkbox"
                                                class={CHECKBOX_INPUT_CSS}
                                                onclick={ checkbox_onclick.clone() }
                                                id={ idx.to_string() }
                                                checked={ value.iter().find_map(|v| v.as_bool()).unwrap_or(false) }
                                                />
                                            </div>
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
                                        if value.is_some() {
                                            <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer">
                                                <i id={idx.to_string()} class="icon-plus" onclick={add_duration_onclick.clone()} />
                                            </div>
                                        }
                                        <label for={ idx.to_string() } class={ INPUT_LABEL_CSS }>
                                            <i class="icon-clock"></i>
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
                                            <i class="icon-clock"></i>
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
                                            <i class="icon-doc"></i>
                                            { format!(" {}: ", practice) }
                                        </label>
                                    </div>
                                }
                            }})
                    }
                </div>
            </div>
        </BlankPage>
    }
}
