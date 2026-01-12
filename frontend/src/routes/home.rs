use std::collections::HashSet;

use chrono::Local;
use gloo::utils::window;
use tw_merge::*;
use wasm_bindgen::JsCast;
use web_sys::{HtmlElement, HtmlInputElement};
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount};

use crate::{
    components::{
        blank_page::{BlankPage, CalendarProps, HeaderButtonProps},
        list_errors::ListErrors,
        prompt::Prompt,
    },
    css::*,
    hooks::{SessionStateContext, use_cache_aware_async, use_visibility},
    i18n::{Locale, PracticeName},
    model::{DiaryEntry, PracticeDataType, PracticeEntryValue},
    services::{get_diary_day, get_user_practices, save_diary_entry, url},
    utils::time_dur_input_support::*,
};

use super::AppRoute;

#[function_component(Home)]
pub fn home() -> Html {
    let today = Local::now().date_naive();
    let session_ctx = use_context::<SessionStateContext>().expect("No session state found");

    // A copy of backend data with local changes
    let local_diary_entry = use_list(Vec::new());
    let current_entry = use_state(|| None::<DiaryEntry>);
    let add_duration_prompt_idx = use_state(|| None::<usize>);
    // use_mut_ref is to avoid re-rendering on every key press
    let backspace_key_pressed = use_mut_ref(|| false);
    let visibility = use_visibility();

    let required_practices = use_cache_aware_async(
        url::GET_USER_PRACTICES.to_string(),
        |cache_only| async move {
            get_user_practices(cache_only).await.map(|res| {
                res.user_practices
                    .into_iter()
                    .filter_map(|p| p.is_required.and_then(|req| req.then_some(p.practice)))
                    .collect::<HashSet<_>>()
            })
        },
    );

    let diary_entry = {
        let session = session_ctx.clone();
        use_cache_aware_async(
            url::get_diary_day(&session.selected_date),
            move |from_cache| {
                let session = session.clone();
                async move {
                    get_diary_day(&session.selected_date, from_cache)
                        .await
                        .map(|je| je.diary_day)
                }
            },
        )
    };

    let save_diary_day_entry = {
        let session = session_ctx.clone();
        let entry = current_entry.clone();
        use_async(async move {
            if let Some(e) = &*entry {
                save_diary_entry(&session.selected_date, e).await.map(|_| {
                    entry.set(None);
                })
            } else {
                Ok(())
            }
        })
    };

    {
        let required_practices = required_practices.clone();
        use_mount(move || {
            required_practices.run();
        });
    }

    {
        // Reload the home screen if the browser window was inactive.
        // Mostly needed to refresh the app on a phone after it was minimized to
        // pick up any concurrent changes
        let diary_entry = diary_entry.clone();
        let required_practices = required_practices.clone();
        use_effect_with(visibility.clone(), move |v| {
            if v.visible {
                diary_entry.run();
                required_practices.run();
            } else if let Some(e) = window()
                .document()
                .unwrap()
                .active_element()
                .and_then(|e| e.dyn_into::<HtmlElement>().ok())
            {
                e.blur().unwrap();
            }
        });
    }

    {
        // Fetch data from server on date change
        let diary_entry = diary_entry.clone();
        use_effect_with(session_ctx.clone(), move |_| {
            diary_entry.run();
            || ()
        });
    }

    {
        // Update local state from server data when the later changes
        let local = local_diary_entry.clone();
        use_effect_with(diary_entry.clone(), move |je| {
            if !je.loading {
                je.data.iter().for_each(|data| {
                    local.set(data.clone());
                });
            }
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

    let onchange_int = {
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

    let onkeydown_time_dur = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: KeyboardEvent| {
            *back.borrow_mut() = e.key() == "Backspace";
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

    let date_is_incomplete = (session_ctx.selected_date < today)
        .then_some(0)
        .and_then(|_| required_practices.data.as_ref())
        .map(|required| {
            local_diary_entry
                .current()
                .iter()
                .any(|v| required.contains(&v.practice) && v.value.is_none())
        });

    html! {
        <BlankPage
            right_button={HeaderButtonProps::new_icon_redirect(AppRoute::UserPractices, "icon-bars")}
            show_footer=true
            selected_page={AppRoute::Home}
            calendar={CalendarProps::new(date_is_incomplete)}
        >
            if let Some(idx) = *add_duration_prompt_idx {
                <Prompt
                    title={Locale::current().prompt_title_add_dur(PracticeName(&local_diary_entry.current()[idx].practice))}
                    description={Locale::current().prompt_desc_add_dur(PracticeName(&local_diary_entry.current()[idx].practice))}
                    onsuccess={add_duraction.clone()}
                    oncancel={add_duration_onclick.clone()}
                />
            }
            <ListErrors
                error={diary_entry.error.clone()}
            />
            <ListErrors error={save_diary_day_entry.error.clone()} />
            <div class={BODY_DIV_SPACE_10_CSS}>
                <div class={TWO_COLS_CSS}>
                    { for local_diary_entry.current().iter().enumerate().map(|(idx, DiaryEntry {practice, data_type, dropdown_variants, value})| {
                        let wrapper_css =
                            (value.is_none() && !diary_entry.loading && session_ctx.selected_date < today)
                                .then_some(0)
                                .and_then(|_| required_practices.data.as_ref())
                                .filter(|req| req.contains(practice))
                                .map(|_| {"group is-incomplete"})
                                .unwrap_or_default();

                        let to_options = |variants: &str| {
                            let is_selected = |v| {
                                value
                                    .as_ref()
                                    .map(|val| val.to_string() == v)
                                    .unwrap_or(false)
                            };

                            let mut found_selected = false;

                            let mut opts = variants
                            .split(',')
                            .map(str::trim)
                            .filter(|s| !s.is_empty())
                            .map(|v| {
                                let selected = is_selected(v);
                                if !found_selected {
                                    found_selected = selected;
                                }
                                html! {
                                    <option class={"text-black"} {selected} value={v.to_string()}>{v}</option>
                                }
                            })
                            .collect::<Vec<Html>>();

                            let empty = html! {
                                <option
                                class={"text-black"}
                                value=""
                                selected={value.is_none() || !found_selected} />
                            };

                            opts.insert(0, empty);
                            opts
                        };

                        let input_html = match data_type {
                            PracticeDataType::Int => html! {
                                <div class="relative" key={practice.clone()} >
                                    if let Some(variants) = dropdown_variants.as_ref() {
                                        <select
                                            onchange={onchange_int.clone()}
                                            id={idx.to_string()}
                                            class={
                                                tw_merge!(
                                                    "appearance-none",
                                                    INPUT_CSS,
                                                    "text-center [text-align-last:center]",
                                                    if value.as_ref().is_some_and(|v| !v.to_string().is_empty()) {
                                                        "has-value"
                                                    } else {
                                                        ""
                                                    })
                                            } >
                                            {to_options(variants)}
                                        </select>
                                    } else {
                                        <input
                                            onchange={onchange_int.clone()}
                                            type="number"
                                            inputmode="numeric"
                                            id={idx.to_string()}
                                            value={value.iter().find_map(|v| v.as_int().map(|i| i.to_string())).unwrap_or_default()}
                                            min="0"
                                            max="174"
                                            placeholder={idx.to_string()}
                                            autocomplete="off"
                                            class={tw_merge!(INPUT_CSS, "text-center")}
                                            />
                                    }
                                    <label
                                        for={idx.to_string()}
                                        class={if dropdown_variants.is_some() {INPUT_SELECT_LABEL_CSS} else {INPUT_LABEL_CSS}}
                                    >
                                        <i class="icon-rounds"/>
                                        {format!(" {practice}: ")}
                                    </label>
                                </div>
                                },
                            PracticeDataType::Bool => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                        <span class=""><i class="icon-tick"></i>{ format!(" {practice}: ") }</span>
                                        <div class="flex">
                                            <input
                                                type="checkbox"
                                                class={CHECKBOX_INPUT_CSS}
                                                onclick={checkbox_onclick.clone()}
                                                id={idx.to_string()}
                                                checked={value.iter().find_map(|v| v.as_bool()).unwrap_or(false)}
                                                />
                                        </div>
                                    </label>
                                </div>
                                },
                            PracticeDataType::Duration => html! {
                                <div class="relative" key={ practice.clone() } >
                                    <input
                                        autocomplete="off"
                                        id={idx.to_string()}
                                        type="text"
                                        inputmode="numeric"
                                        onblur={onblur_time_dur(false)}
                                        oninput={oninput_duration(backspace_key_pressed.clone())}
                                        onkeydown={onkeydown_time_dur.clone()}
                                        value={value.iter().find_map(|v| v.as_duration_str()).unwrap_or_default()}
                                        class={tw_merge!(INPUT_CSS, "text-center")}
                                        placeholder={idx.to_string()}
                                        />
                                    if value.is_some() {
                                        <div
                                            id={idx.to_string()}
                                            class="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 cursor-pointer"
                                            onclick={add_duration_onclick.clone()}
                                            >
                                            <i id={idx.to_string()} class="icon-plus"  />
                                        </div>
                                    }
                                    <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                                        <i class="icon-timer"/>
                                        {format!(" {practice}: ")}
                                    </label>
                                </div>
                                },
                            PracticeDataType::Time => html! {
                                <div class="relative" key={practice.clone()} >
                                    <input
                                        autocomplete="off"
                                        id={idx.to_string()}
                                        type="text"
                                        inputmode="numeric"
                                        onblur={onblur_time_dur(true)}
                                        onfocus={
                                            Callback::from(move |e: FocusEvent| {
                                                let mut input: HtmlInputElement = e.target_unchecked_into();
                                                format_time(&mut input, false);
                                            })
                                        }
                                        oninput={
                                            let back = backspace_key_pressed.clone();
                                            Callback::from(move |e: InputEvent| {
                                                let mut input: HtmlInputElement = e.target_unchecked_into();
                                                format_time(&mut input, *back.borrow());
                                            })
                                        }
                                        onkeydown={onkeydown_time_dur.clone()}
                                        value={ value.iter().find_map(|v| v.as_time_str()).unwrap_or_default() }
                                        class={tw_merge!(INPUT_CSS, "text-center")}
                                        placeholder={idx.to_string()}
                                        />
                                    <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                                        <i class="icon-clock"/>
                                        {format!(" {practice}: ")}
                                    </label>
                                </div>
                                },
                            PracticeDataType::Text => html! {
                                <div class="relative" key={practice.clone()} >
                                    if let Some(variants) = dropdown_variants.as_ref() {
                                        <select
                                            onchange={onchange_int.clone()}
                                            id={idx.to_string()}
                                            class={
                                                tw_merge!(
                                                    "appearance-none",
                                                    INPUT_CSS,
                                                    if value.as_ref().is_some_and(|v| !v.to_string().is_empty()) {
                                                        "has-value"
                                                    } else {
                                                        ""
                                                    })
                                            } >
                                            {to_options(variants)}
                                        </select>
                                    } else {
                                        <textarea
                                            id={idx.to_string()}
                                            class={TEXTAREA_CSS}
                                            maxlength="1024"
                                            rows="4"
                                            placeholder={idx.to_string()}
                                            onchange={onchange_int.clone()}
                                            value={value.iter().find_map(|v| v.as_text()).unwrap_or_default()}
                                            >
                                        </textarea>
                                    }
                                    <label
                                        for={idx.to_string()}
                                        class={if dropdown_variants.is_some() {INPUT_SELECT_LABEL_CSS} else {INPUT_LABEL_CSS}}>
                                        <i class="icon-doc"></i>
                                        {format!(" {practice}: ")}
                                    </label>
                                </div>
                            }
                        };

                        html! {
                            <div class={wrapper_css}>{input_html}</div>
                        }
                    }) }
                </div>
            </div>
        </BlankPage>
    }
}
