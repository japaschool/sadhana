use std::{cell::RefCell, rc::Rc};

use js_sys::RegExp;
use lazy_static::lazy_static;
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::i18n::Locale;

lazy_static! {
    static ref VALID_DURATION_R_P: String = {
        let h = Locale::current().hours_label();
        let m = Locale::current().minutes_label();
        // There are 3 mutually exclusive regex patterns here.
        // (1) 3 digits representing minutes. No hours are allowed.
        // (2) Number up to 23 for hours only when no minutes are entered.
        // (3) Number between 0 and 23 for hours when minutes are also present.
        // (4) Optional separator between hours and minutes.
        // (5) 2 digits for minutes in presence of hours. Limited to the number 59.
        //
        //          |------1-----|     |---------2--------|               |---------3--------||-----4-----| |-----5-----|
        format!(r#"^(?:(\d{{1,3}}){m}?|([0-1]?[0-9]|2[0-3])(?:{h}?\s?|:)?|([0-1]?[0-9]|2[0-3])(?:{h}?\s?|:)?([0-5]?[0-9]){m}?)$"#)
    };
}

pub const TIME_PATTERN: &str = "--:--";

pub fn oninput_duration(backspace_pressed: Rc<RefCell<bool>>) -> Callback<InputEvent> {
    let valid_dur_r = RegExp::new(&VALID_DURATION_R_P, "");
    let back = backspace_pressed.clone();
    Callback::from(move |e: InputEvent| {
        let input: HtmlInputElement = e.target_unchecked_into();

        if *back.borrow() {
            return;
        }

        let idx = input.selection_start().unwrap().unwrap();
        let mut s = input.value();

        // Remove any invalid characters
        while !valid_dur_r.test(&s) {
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
}

pub fn format_time(input: &mut HtmlInputElement, back: bool) {
    let sel_start = input.selection_start().unwrap().unwrap();
    let sel_end = input.selection_end().unwrap().unwrap();
    let input_value = input.value();

    // Remove anything but digits
    let mut sanitized = input_value
        .chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>();

    // Inject zeroes in the relevant places
    if sanitized.len() == 1 && sanitized.parse::<u32>().unwrap() > 2 {
        sanitized.insert(0, '0');
    } else if sanitized.len() == 2 && sanitized.parse::<u32>().unwrap() > 23 {
        sanitized.remove(1);
    } else if sanitized.len() == 3 && sanitized.chars().nth(2).unwrap().to_digit(10).unwrap() > 5 {
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
}

pub fn format_duration(input: &mut HtmlInputElement) {
    format_duration_str(&input.value())
        .iter()
        .for_each(|new_value| input.set_value(new_value));
}

fn format_duration_str(input_value: &str) -> Option<String> {
    let valid_dur_r = RegExp::new(&VALID_DURATION_R_P, "");

    if input_value.is_empty() {
        return None;
    }

    valid_dur_r.exec(input_value).map(|cap| {
        let (hours, minutes) = match (cap.get(1), cap.get(2), cap.get(3), cap.get(4)) {
            (minutes_only, _, _, _) if !minutes_only.is_undefined() => {
                let mins = minutes_only.as_string().unwrap().parse::<u32>().unwrap();
                ((mins / 60).to_string(), (mins % 60).to_string())
            }
            (_, hours_only, _, _) if !hours_only.is_undefined() => {
                (hours_only.as_string().unwrap(), "0".into())
            }
            (_, _, hours, minutes) if !hours.is_undefined() && !minutes.is_undefined() => {
                (hours.as_string().unwrap(), minutes.as_string().unwrap())
            }
            _ => unreachable!(),
        };
        let hours_str = if hours == "0" {
            String::new()
        } else {
            format!("{}{}", hours, Locale::current().hours_label(),)
        };
        format!(
            "{}{}{}",
            hours_str,
            minutes,
            Locale::current().minutes_label()
        )
    })
}

#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;

    #[test]
    fn test_format_duration() {
        let input = "90"; // 90 minutes
        let expected = Some("1h30m".to_string());
        assert_eq!(format_duration(input), expected);

        let input = "120"; // 120 minutes
        let expected = Some("2h0m".to_string());
        assert_eq!(format_duration(input), expected);

        let input = ""; // Empty input
        let expected = None;
        assert_eq!(format_duration(input), expected);

        let input = "23h"; // Invalid input
        let expected = None;
        assert_eq!(format_duration(input), expected);
    }
}
