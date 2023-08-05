use std::collections::HashMap;

use anyhow::{anyhow, Context, Result};
use chrono::NaiveDate;
use common::error::AppError;
use csv::{Reader, ReaderBuilder, StringRecord};
use futures::future::join_all;
use gloo::file::File;
use gloo_dialogs::confirm;
use wasm_bindgen_futures::spawn_local;
use web_sys::{FileList, HtmlInputElement};
use yew::prelude::*;
use yew_hooks::{
    use_async, use_bool_toggle, use_effect_update_with_deps, use_list, use_map, use_mount,
    UseAsyncHandle, UseListHandle,
};
use yew_router::prelude::use_navigator;

use crate::{
    components::{blank_page::BlankPage, calendar::DATE_FORMAT, list_errors::ListErrors},
    css::*,
    i18n::*,
    model::{DiaryDay, DiaryEntry, PracticeDataType, PracticeEntryValue},
    routes::AppRoute,
    services::{get_user_practices, save_diary},
};

#[function_component(Import)]
pub fn import() -> Html {
    let csv_data = use_state(|| None::<String>);
    let headers = use_list(vec![]);
    let headers_types = use_map(HashMap::new());
    let saving = use_bool_toggle(false);
    let successes: UseListHandle<DiaryDay> = use_list(vec![]);
    let failures = use_list(vec![]);
    let nav = use_navigator().unwrap();

    let all_practices = use_async(async move {
        get_user_practices().await.map(|res| {
            res.user_practices
                .iter()
                .map(|up| (up.practice.clone(), up.data_type))
                .collect::<HashMap<_, _>>()
        })
    });

    let save: UseAsyncHandle<Vec<()>, AppError> = {
        let successes = successes.clone();
        let nav = nav.clone();
        use_async(async move {
            log::debug!("Saving: {:?}", successes.current());
            let res = join_all(
                successes
                    .current()
                    .iter()
                    .map(|dd| save_diary((*dd).clone())),
            )
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>();

            if let Ok(res) = res.as_ref() {
                confirm(&Locale::current().import_success_msg(SuccessQty(&res.len().to_string())));
                nav.push(&AppRoute::Settings);
            }

            res
        })
    };

    {
        let all = all_practices.clone();
        use_mount(move || {
            all.run();
        });
    }

    fn scv_reader(data: &str) -> Reader<&[u8]> {
        ReaderBuilder::new()
            .delimiter(b',')
            .has_headers(true)
            .from_reader(data.as_bytes())
    }

    {
        let headers = headers.clone();
        let headers_types = headers_types.clone();
        use_effect_update_with_deps(
            move |data| {
                if let Some(data) = data.as_ref() {
                    let mut rdr = scv_reader(data);
                    let hs = rdr
                        .headers()
                        .unwrap()
                        .iter()
                        .map(|h| h.to_owned())
                        .collect::<Vec<_>>();
                    headers_types.set(
                        hs.iter()
                            .map(|h| (h.to_owned(), None::<PracticeDataType>))
                            .collect(),
                    );
                    headers.set(hs);
                }
                || ()
            },
            csv_data.clone(),
        );
    }

    let upload_files = {
        let scv_data = csv_data.clone();
        move |files: Option<FileList>| {
            let mut result = Vec::new();

            if let Some(files) = files {
                let files = js_sys::try_iter(&files)
                    .unwrap()
                    .unwrap()
                    .map(|v| web_sys::File::from(v.unwrap()))
                    .map(File::from);
                result.extend(files);
            }

            if let Some(f) = result.into_iter().next() {
                let csv_data = scv_data.clone();
                spawn_local(async move {
                    gloo::file::futures::read_as_text(&f)
                        .await
                        .map(|data| {
                            log::debug!("Read file: {:?}", data);
                            csv_data.set(Some(data));
                        })
                        .unwrap()
                });
            }
        }
    };

    let upload_onclick = {
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            upload_files(input.files())
        })
    };

    let data_type_onchange = {
        let headers_types = headers_types.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();

            headers_types.update(
                &input.id(),
                PracticeDataType::try_from(input.value().as_str()).ok(),
            );
        })
    };

    fn to_diary_day(
        row: StringRecord,
        headers: &[(&str, &Option<PracticeDataType>)],
    ) -> Result<DiaryDay> {
        let mut diary_day = vec![];
        let mut it = headers.iter().zip(row.iter());

        let (_, cob) = it
            .next()
            .ok_or_else(|| anyhow!(Locale::current().import_row_parse_err()))?;
        let cob_date = NaiveDate::parse_from_str(cob, DATE_FORMAT)
            .with_context(|| Locale::current().import_cob_parse_err(Cob(cob)))?;

        for (&h, data_type, v) in
            it.filter_map(|((h, data_type), v)| data_type.map(|dt| (h, dt, v)))
        {
            let value = (!v.trim().is_empty())
                .then(|| PracticeEntryValue::try_from((&data_type, v)))
                .transpose()?;
            let entry = DiaryEntry {
                practice: h.to_owned(),
                data_type,
                value,
            };
            diary_day.push(entry);
        }

        Ok(DiaryDay {
            cob_date,
            diary_day,
        })
    }

    let onsubmit = {
        let data = csv_data.clone();
        let headers = headers.clone();
        let headers_types = headers_types.clone();
        let saving = saving.clone();
        let successes = successes.clone();
        let failures = failures.clone();
        let save = save.clone();
        let practices = all_practices.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            saving.toggle();
            if let (Some(data), Some(practices)) = (data.as_ref(), practices.data.as_ref()) {
                let mut rdr = scv_reader(data);
                let ht = headers_types.current();
                let headers = headers.current();
                let hd = headers
                    .iter()
                    .map(|h| (h.as_str(), ht.get(&*h).unwrap()))
                    .collect::<Vec<_>>();

                hd.iter().for_each(|(h, t)| {
                    if let Some(t) = t {
                        if let Some(saved_type) = practices.get(*h) {
                            if t != saved_type {
                                failures.push((
                                    None,
                                    Locale::current().import_wrong_type_err(
                                        Practice(h),
                                        SavedType(&saved_type.to_string()),
                                        SelectedType(&t.to_string()),
                                    ),
                                ));
                            }
                        } else {
                            failures.push((
                                None,
                                Locale::current().import_no_such_practice_err(Practice(h)),
                            ));
                        }
                    }
                });

                let no_errors = failures.current().is_empty();

                if no_errors {
                    for (row_num, row) in rdr.records().enumerate() {
                        let dd = row
                            .map_err(|e| anyhow::Error::from(e))
                            .with_context(|| Locale::current().import_row_parse_err())
                            .and_then(|row| to_diary_day(row, &*hd));
                        if let Ok(dd) = dd {
                            successes.push(dd);
                        } else {
                            failures.push((
                                Some(row_num),
                                dd.err().map(|e| e.to_string()).unwrap_or_default(),
                            ));
                        }
                    }
                    if failures.current().is_empty() {
                        save.run();
                    }
                }
            }

            saving.toggle();
        })
    };

    let columns_picker = {
        log::debug!(
            "Building columns list from headers: {:?}",
            headers.current()
        );
        html! {
            <>
                {headers.current().iter().skip(1).map(|h| html! {
                    <div class="relative">
                        <select onchange={data_type_onchange.clone()} class={INPUT_CSS} id={h.clone()}>
                            <option class={ "text-black" } value="int">{ Locale::current().integer() }</option>
                            <option class={ "text-black" } value="time">{ Locale::current().time() }</option>
                            <option class={ "text-black" } value="bool">{ Locale::current().boolean() }</option>
                            <option class={ "text-black" } value="text">{ Locale::current().text() }</option>
                            <option class={ "text-black" } value="duration">{ Locale::current().duration() }</option>
                            <option class={ "text-black" } value="" selected=true>{ Locale::current().select_data_type() }</option>
                        </select>
                        <label for={h.clone()} class={INPUT_LABEL_CSS}>{h}</label>
                    </div>
                }).collect::<Html>()}
                <div class="relative">
                    <button type="submit" class={ SUBMIT_BTN_CSS }>{ Locale::current().import_csv() }</button>
                </div>
            </>
        }
    };

    let file_picker = html! {
        <div class="relative">
            <input
                id="file-upload"
                type="file"
                accept="text/csv"
                onchange={upload_onclick}
                multiple={false}
                class={ format!("{} text-center", INPUT_CSS) }
                />
            <label for="file-upload" class={ INPUT_LABEL_CSS }>
                <i class="icon-doc"></i>
                { format!(" {}: ", Locale::current().import_file_select()) }
            </label>
        </div>
    };

    let list_failures = {
        failures
            .current()
            .iter()
            .map(|(line, msg)| {
                let line = line.iter().map(|l| (l + 1).to_string()).next().unwrap_or_default();
                html! {
                    <span class="text-zinc-500 dark:text-zinc-200">{
                        format!(
                            "{}{msg}",
                            (!line.is_empty())
                                .then(|| format!("{}: ", Locale::current().import_failure_line_num_msg(LineNum(&line))))
                                .unwrap_or_default()
                        )
                    }</span>
                }
            })
            .collect::<Html>()
    };

    html! {
        <BlankPage
            header_label={Locale::current().import_csv()}
            show_footer=true
            loading={*saving || save.loading || all_practices.loading}
            prev_link={(Locale::current().cancel(), AppRoute::Settings)}
            >
            <ListErrors error={save.error.clone()} />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div>
                        <h5 class="text-center mb-4 text-xl font-medium leading-tight">{Locale::current().import_instructions_header()}</h5>
                        {for Locale::current()
                            .import_instructions_body()
                            .lines()
                            .map(|l| html! {<p class="text-zinc-500 dark:text-zinc-200">{l}</p>})}
                    </div>
                    {if csv_data.is_none() {
                        file_picker
                    } else if !failures.current().is_empty() {
                        list_failures
                    } else {
                        columns_picker
                    }}
                </div>
            </form>
        </BlankPage>
    }
}
