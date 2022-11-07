use std::collections::HashMap;

use chrono::prelude::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_map};
use yew_router::prelude::*;

use super::AppRoute;
use crate::{
    hooks::use_user_context,
    model::{JournalEntry2, PracticeEntry, PracticeEntryValue},
    services::fetch,
};

#[function_component(Home)]
pub fn home() -> Html {
    let user_ctx = use_user_context();

    // FIXME: when user opens home page display login screen if there's no valid token in the storage
    // The code below does not work cause user context gets refreshed only after the page rendering
    // is finished. Had we stayed on the home page it would have triggered re-rendering. But we
    // redirect prematurely.
    if !user_ctx.is_authenticated() {
        log::debug!("User is not authenticated. Redirecting to Login page.");
        // return html! {
        //     <Redirect<AppRoute> to={AppRoute::Login}/>
        // };
    }

    let current_date = use_state(|| Local::now().date());
    let form_changed = use_state(|| false);
    let je2 = use_map(HashMap::from([
        ("Total Rounds".to_string(), PracticeEntryValue::Int(16)),
        (
            "Wake Up Time".to_string(),
            PracticeEntryValue::Time { h: 5, m: 10 },
        ),
        ("Настройка".to_string(), PracticeEntryValue::Bool(true)),
    ]));
    let journal_entry = {
        let current_date = current_date.clone();
        use_async(async move { fetch(&*current_date).await })
    };

    {
        let journal_entry = journal_entry.clone();
        use_effect_with_deps(
            move |_| {
                journal_entry.run();
                || ()
            },
            current_date.clone(),
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
        let je2 = je2.clone();
        let form_changed = form_changed.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let maybe_new_val = je2
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
                je2.update(&input.name(), v);
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
                        je2.current().iter().map(|(practice_name, value)| {
                            html!{
                                <fieldset key={practice_name.clone()}>
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
                                </fieldset>
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
            { journal_entry.data.as_ref().map_or_else(|| html!{}, |je| html!{
                <>
                    <p>{ format!("Rounds before 7am: {}",  je.rounds_before_7) }</p>
                    <p>{ format!("Rounds total: {}",  je.rounds_total) }</p>
                </>
            }) }
        </div>
    }
}
