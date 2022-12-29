use chrono::prelude::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_list};
use yew_router::prelude::*;

use crate::{
    model::{DiaryDay, DiaryEntry, PracticeDataType, PracticeEntryValue},
    services::{get_diary_day, save_diary},
};

use super::AppRoute;

#[function_component(Home)]
pub fn home() -> Html {
    let current_date = use_state(|| Local::now().date_naive());
    // A copy of backend data with local changes
    let local_diary_entry = use_list(Vec::new());
    // A copy of the backend state without local values changes.
    // Used as reference for getting indexes and data types of entries to avoid
    // immutable borrowing of the local change buffer.
    let static_diary_entry = use_state(|| Vec::new());
    let diary_entry = {
        let current_date = current_date.clone();
        use_async(async move { get_diary_day(&*current_date).await.map(|je| je.diary_day) })
    };
    let save_diary_day = {
        let local = local_diary_entry.clone();
        let cob = current_date.clone();
        use_async(async move {
            save_diary(DiaryDay {
                diary_day: local.current().to_owned(),
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
            current_date.clone(),
        );
    }

    {
        // Update local state from server data when the later changes
        let local = local_diary_entry.clone();
        let local2 = static_diary_entry.clone();
        use_effect_with_deps(
            move |je| {
                je.data.iter().for_each(|data| local.set(data.clone()));
                local2.set(local.current().clone());
                || ()
            },
            diary_entry.clone(),
        );
    }

    let decr_date = {
        let current_date = current_date.clone();
        Callback::from(move |ev: MouseEvent| {
            ev.prevent_default();
            current_date.set(current_date.pred_opt().unwrap());
        })
    };

    let inc_date = {
        let current_date = current_date.clone();
        Callback::from(move |ev: MouseEvent| {
            ev.prevent_default();
            current_date.set(current_date.succ_opt().unwrap());
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

    let oninput = {
        let change_buffer = local_diary_entry.clone();
        let ref_diary_entry = static_diary_entry.clone();
        let save_diary_day = save_diary_day.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let idx: usize = input.id().parse().unwrap();
            let mut current = ref_diary_entry[idx].clone();
            let new_val = get_new_val(&input, &current);

            current.value = new_val;
            change_buffer.update(idx, current);
            save_diary_day.run();
        })
    };

    html! {
        <div>
            <h1>{"Sadhana Pro"}</h1>
            <p>
                <button onclick={decr_date}>{"<"}</button>
                { current_date.format(" %a, %-d ") }
                <button onclick={inc_date}>{">"}</button>
            </p>
            <fieldset> {
                local_diary_entry.current().iter().enumerate().map(|(idx, DiaryEntry {practice, data_type, value})| {
                    html!{
                        <div key={practice.clone()}>
                            <label>{ format!("{}: ", practice) }</label>
                            { match data_type {
                                PracticeDataType::Int => html!{
                                    <input
                                        oninput={ oninput.clone() }
                                        id={ idx.to_string() }
                                        type="number"
                                        value={ value.iter().find_map(|v| v.as_int().map(|i| i.to_string())).unwrap_or_default() }
                                        min="0"
                                        />
                                    },
                                PracticeDataType::Bool => html!{
                                    <input
                                        onclick={ checkbox_onclick.clone() }
                                        id={ idx.to_string() }
                                        type="checkbox"
                                        checked={  value.iter().find_map(|v| v.as_bool()).unwrap_or(false)  }
                                        />
                                    },
                                PracticeDataType::Time => html!{
                                    <input
                                        oninput={ oninput.clone() }
                                        id={ idx.to_string() }
                                        type="time"
                                        value={ value.iter().find_map(|v| v.as_time_str()).unwrap_or_default() }
                                        />
                                    },
                                PracticeDataType::Text => html!{
                                    <input
                                        oninput={ oninput.clone() }
                                        id={ idx.to_string() }
                                        type="text"
                                        maxlength=1024
                                        value={ value.iter().find_map(|v| v.as_text()).unwrap_or_default() }
                                        />
                                }
                            }
                        } </div>
                    }
                }).collect::<Html>()
            } </fieldset>
            <p>
                <Link<AppRoute> to={AppRoute::UserPractices}>
                    { "Modify practices" }
                </Link<AppRoute>>
            </p>
        </div>
    }
}
