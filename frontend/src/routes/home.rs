use std::collections::HashMap;

use chrono::prelude::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_map};

use crate::{model::PracticeEntryValue, services::fetch};

#[function_component(Home)]
pub fn home() -> Html {
    let current_date = use_state(|| Local::now().date());
    let form_changed = use_state(|| false);
    let local_diary_entry = use_map(HashMap::new());
    let diary_entry = {
        let current_date = current_date.clone();
        use_async(async move { fetch(&*current_date).await.map(|je| je.values) })
    };

    {
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
        let lje = local_diary_entry.clone();
        use_effect_with_deps(
            move |je| {
                je.data.iter().for_each(|data| lje.set(data.clone()));
                || ()
            },
            diary_entry.clone(),
        );
    }

    let decr_date = {
        let current_date = current_date.clone();
        Callback::from(move |ev: MouseEvent| {
            ev.prevent_default();
            current_date.set(current_date.pred());
        })
    };

    let inc_date = {
        let current_date = current_date.clone();
        Callback::from(move |ev: MouseEvent| {
            ev.prevent_default();
            current_date.set(current_date.succ());
        })
    };

    let oninput = {
        let lje = local_diary_entry.clone();
        let form_changed = form_changed.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let maybe_new_val = lje
                .current()
                .get(input.name().as_str())
                .and_then(|v| match v {
                    PracticeEntryValue::Int(_) => input
                        .value()
                        .parse()
                        .map(|v| PracticeEntryValue::Int(v))
                        .ok(),
                    PracticeEntryValue::Bool(_) => Some(PracticeEntryValue::Bool(input.checked())),
                    PracticeEntryValue::Time { h: _, m: _ } => {
                        input.value().split_once(":").and_then(|(h, m)| {
                            let h = h.parse().ok()?;
                            let m = m.parse().ok()?;
                            Some(PracticeEntryValue::Time { h, m })
                        })
                    }
                });
            maybe_new_val.into_iter().for_each(|v| {
                lje.update(&input.name(), v);
                form_changed.set(true);
            });
        })
    };

    let onsubmit = {
        let form_changed = form_changed.clone();
        Callback::from(move |e: FocusEvent| {
            e.prevent_default(); /* Prevent event propagation */
            form_changed.set(false);
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
            <form {onsubmit}>
                <fieldset>
                    {
                        //FIXME: The order of a hash map is random. Need to sort here somehow by practice name
                        local_diary_entry.current().iter().map(|(practice_name, value)| {
                            html!{
                                <div key={practice_name.clone()}>
                                    <label>{ format!("{}: ", practice_name) }</label>
                                    {
                                        match value {
                                            PracticeEntryValue::Int(i) => html!{
                                                                            <input
                                                                                oninput={ oninput.clone() }
                                                                                name={ practice_name.clone() }
                                                                                type="number"
                                                                                value={ i.to_string() }
                                                                                min="0"
                                                                                />
                                                                            },
                                            PracticeEntryValue::Bool(b) => html!{
                                                                            <input
                                                                                oninput={ oninput.clone() }
                                                                                name={ practice_name.clone() }
                                                                                type="checkbox"
                                                                                checked={ *b }
                                                                                />
                                                                            },
                                            PracticeEntryValue::Time{h, m} => html!{
                                                                                <input
                                                                                    oninput={ oninput.clone() }
                                                                                    name={ practice_name.clone() }
                                                                                    type="time"
                                                                                    value={ format!("{:0width$}:{:0width$}", h, m, width = 2) }
                                                                                    />
                                                                                },
                                        }
                                    }
                                </div>
                            }
                        }).collect::<Html>()
                    }
                </fieldset>
                <button
                    type="submit"
                    disabled={ !*form_changed } >
                    { "Save" }
                </button>
            </form>
        </div>
    }
}
