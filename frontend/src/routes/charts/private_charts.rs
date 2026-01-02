use std::error::Error;

use super::{
    Report, ReportDefinition, SELECTED_REPORT_ID_KEY, SelectedReportId, base::ChartsBase,
    graph_editor::GraphEditor, grid_editor::GridEditor,
};
use crate::{
    components::{
        blank_page::{BlankPage, CalendarProps, CtxMenuEntry, HeaderButtonProps},
        list_errors::ListErrors,
        share_link::{ShareLink, can_share, emit_signal_callback, set_signal_callback},
    },
    hooks::{SessionStateContext, use_user_context},
    i18n::Locale,
    model::ReportData,
    routes::AppRoute,
    services::{get_user_practices, report::*},
};
use common::ReportDuration;
use csv::Writer;
use gloo::storage::{LocalStorage, Storage};
use gloo_dialogs::confirm;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::spawn_local;
use web_sys::{BlobPropertyBag, HtmlElement};
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle, use_mount};

#[function_component(Charts)]
pub fn charts() -> Html {
    let session_ctx = use_context::<SessionStateContext>().expect("No session state found");
    let user_ctx = use_user_context();
    let duration = use_state(|| ReportDuration::Week);
    let editing = use_bool_toggle(false);
    let active_report = use_state(|| None::<Report>);
    let share_signal = use_state(|| None::<Callback<_>>);

    let can_share = can_share();
    let share_icon = if can_share {
        "icon-share"
    } else {
        "icon-doc-dup"
    };
    let share_label = if can_share {
        Locale::current().share_reports_link()
    } else {
        Locale::current().copy_reports_link()
    };

    let reports = use_async(async move { get_reports().await.map(|res| res.reports) });

    let delete_report = {
        let reports = reports.clone();
        let editing = editing.clone();
        let active_report = active_report.clone();
        use_async(async move {
            if let Some(rep) = &*active_report {
                delete_report(&rep.id).await.map(|_| {
                    reports.run();
                    editing.toggle();
                })
            } else {
                Ok(())
            }
        })
    };

    let update_report = {
        let active_report = active_report.clone();
        let reports = reports.clone();
        let editing = editing.clone();
        use_async(async move {
            if let Some(rep) = &*active_report {
                update_report(&rep.id, rep.into()).await.map(|_| {
                    editing.toggle();
                    reports.run();
                })
            } else {
                Ok(())
            }
        })
    };

    let all_practices = use_async(async move {
        get_user_practices().await.map(|res| {
            res.user_practices
                .into_iter()
                .filter(|p| p.is_active)
                .collect::<Vec<_>>()
        })
    });

    let report_data = {
        let duration = duration.clone();
        let session = session_ctx.clone();
        use_async(async move {
            log::debug!("Getting report data for {:?}", session.selected_date);
            get_report_data(&session.selected_date, &duration)
                .await
                .map(|res| res.values)
        })
    };

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        use_mount(move || {
            all_practices.run();
        });
    }

    {
        // Fetch data from server on date change
        let report_data = report_data.clone();
        use_effect_with(session_ctx.clone(), move |_| {
            report_data.run();
            || ()
        });
    }

    let reset_active = {
        let active_report = active_report.clone();
        let reports = reports.clone();
        move || {
            log::debug!("Resetting active");
            if let Some(reports) = &reports.data {
                log::debug!("Resetting active:: found some reports");
                let new_report = LocalStorage::get::<SelectedReportId>(SELECTED_REPORT_ID_KEY)
                    .ok()
                    .and_then(|current_report_id| {
                        reports
                            .iter()
                            .find(|rep| rep.id == current_report_id.report_id)
                    })
                    .or_else(|| reports.first());

                if new_report.is_some() {
                    active_report.set(new_report.cloned());
                }
            }
        }
    };

    {
        let reports = reports.clone();
        use_effect_with(all_practices.clone(), move |_| {
            reports.run();
            || ()
        });
    }

    {
        let reset_active = reset_active.clone();
        use_effect_with(reports.clone(), move |_| {
            reset_active();
            || ()
        });
    }

    let dates_onchange = {
        let report_data = report_data.clone();
        let duration = duration.clone();
        Callback::from(move |dur| {
            duration.set(dur);
            report_data.run();
        })
    };

    let report_onchange = {
        let active = active_report.clone();
        let reports = reports.clone();
        Callback::from(move |id: SelectedReportId| {
            if let Some(reports) = &reports.data {
                active.set(reports.iter().find(|r| r.id == id.report_id).cloned());
                LocalStorage::set(SELECTED_REPORT_ID_KEY, id).unwrap();
            }
        })
    };

    let download_onclick = {
        let duration = duration.clone();
        let session = session_ctx.clone();
        Callback::from(move |_: MouseEvent| {
            let duration = duration.clone();
            let selected_date = session.selected_date;
            spawn_local(async move {
                get_report_data(&selected_date, &duration)
                    .await
                    .map(|data| {
                        // To guarantee UTF-8 (especially for Cyrillic), prepending a UTF-8 BOM
                        let csv = format!("\u{FEFF}{}", to_csv_str(data).unwrap_or_default());
                        let json_jsvalue_array =
                            js_sys::Array::from_iter(std::iter::once(JsValue::from_str(&csv)));
                        let prop = BlobPropertyBag::new();
                        prop.set_type("text/csv;charset=utf-8");

                        let b = web_sys::Blob::new_with_str_sequence_and_options(
                            &json_jsvalue_array,
                            &prop,
                        )
                        .unwrap();
                        let url = web_sys::Url::create_object_url_with_blob(&b).unwrap();
                        let a = web_sys::window()
                            .and_then(|w| w.document())
                            .and_then(|d| d.create_element("a").ok())
                            .and_then(|e| e.dyn_into::<HtmlElement>().ok())
                            .unwrap();

                        a.set_attribute("href", &url).unwrap();
                        a.set_attribute("download", "data.csv").unwrap();
                        a.set_attribute("rel", "noopener").unwrap();

                        // Some Safari versions ignore .click() on detached elements hence temporarily attaching it
                        let document = web_sys::window().unwrap().document().unwrap();
                        document.body().unwrap().append_child(&a).unwrap();

                        a.click();

                        a.remove();
                    })
                    .unwrap();
            });
        })
    };

    let edit_onclick = {
        let editing = editing.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            editing.toggle();
        })
    };

    let onreset = {
        let editing = editing.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            editing.toggle();
            reset_active();
        })
    };

    let onsubmit = {
        let update_report = update_report.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            update_report.run();
        })
    };

    let graph_report_onchange = {
        let report = active_report.clone();
        Callback::from(move |(new_name, new_graph)| {
            if let Some(rep) = &*report {
                let mut new_report = rep.clone();
                new_report.definition = ReportDefinition::Graph(new_graph);
                new_report.name = new_name;
                report.set(Some(new_report));
            }
        })
    };

    let grid_report_onchange = {
        let report = active_report.clone();
        Callback::from(move |(new_name, new_grid)| {
            if let Some(rep) = &*report {
                let mut new_report = rep.clone();
                new_report.definition = ReportDefinition::Grid(new_grid);
                new_report.name = new_name;
                report.set(Some(new_report));
            }
        })
    };

    let report_ondelete = {
        let delete = delete_report.clone();
        Callback::from(move |_| {
            if confirm(Locale::current().report_delete_confirmation_msg().as_str()) {
                delete.run();
            }
        })
    };

    let editor = || match active_report.as_ref().map(|r| &r.definition) {
        Some(ReportDefinition::Graph(rep)) => html! {
            <GraphEditor
                all_practices={all_practices.data.iter().flat_map(|inner| inner.clone()).collect::<Vec<_>>()}
                report={rep.clone()}
                report_name={active_report.as_ref().map(|r| r.name.clone()).unwrap_or_default()}
                report_onchange={graph_report_onchange}
                report_ondelete={report_ondelete.clone()}
            />
        },
        Some(ReportDefinition::Grid(rep)) => html! {
            <GridEditor
                all_practices={all_practices.data.iter().flat_map(|inner| inner.clone()).collect::<Vec<_>>()}
                report={rep.clone()}
                report_name={active_report.as_ref().map(|r| r.name.clone()).unwrap_or_default()}
                report_onchange={grid_report_onchange}
                report_ondelete={report_ondelete.clone()}
            />
        },
        _ => html! {},
    };

    html! {
        <form {onsubmit} {onreset}>
            <BlankPage
                show_footer={!*editing}
                selected_page={AppRoute::Charts}
                calendar={CalendarProps::no_override_selected_date()}
                loading={all_practices.loading
                    || report_data.loading
                    || update_report.loading
                    || delete_report.loading}
                left_button={if *editing {
                        HeaderButtonProps::reset(Locale::current().cancel())
                    } else {
                        HeaderButtonProps::blank()
                    }}
                right_button2={if *editing {
                        HeaderButtonProps::submit(Locale::current().save())
                    } else {
                        HeaderButtonProps::ctx_menu(
                            "icon-ellipsis-vertical",
                            vec![
                                CtxMenuEntry::link(AppRoute::NewReport, "icon-plus", &Locale::current().report_add_new()),
                                CtxMenuEntry::action(download_onclick, "icon-download", &Locale::current().download_csv()),
                                CtxMenuEntry::action(emit_signal_callback(&share_signal), share_icon, &share_label),
                            ]
                        )
                    }}
                right_button={if *editing || active_report.is_none() {
                        HeaderButtonProps::blank()
                    } else {
                        HeaderButtonProps::edit(edit_onclick)
                    }}
            >
                <ListErrors error={all_practices.error.clone()} />
                <ListErrors error={report_data.error.clone()} />
                <ListErrors error={update_report.error.clone()} />
                <ListErrors error={delete_report.error.clone()} />
                if !*editing {
                    <ShareLink
                        relative_link={format!("/shared/{}", user_ctx.id)}
                        run_signal={set_signal_callback(&share_signal)}
                    />
                }
                if let Some(report) = active_report.as_ref() {
                    if all_practices.data.is_some() {
                        <ChartsBase
                            practices={all_practices.data.clone().unwrap_or_default()}
                            reports={reports.data.clone().unwrap_or_default()}
                            report_data={report_data.data.clone().unwrap_or_default()}
                            report={(*report).clone()}
                            {report_onchange}
                            {dates_onchange}
                        />
                    }
                }
                if *editing {
                    { editor() }
                }
            </BlankPage>
        </form>
    }
}

fn to_csv_str(data: ReportData) -> Result<String, Box<dyn Error>> {
    let mut wrt = Writer::from_writer(vec![]);
    let mut practices = vec![Locale::current().date()];
    let mut practices_done = false;
    let mut cob = None;
    let mut row = vec![];
    for entry in data.values {
        let value_str = entry.value.map(|v| v.to_string()).unwrap_or_default();
        if cob.is_none() {
            row.push(entry.cob_date.to_string());
            row.push(value_str);
            cob = Some(entry.cob_date);
            practices.push(entry.practice);
        } else if cob == Some(entry.cob_date) {
            row.push(value_str);
            if !practices_done {
                practices.push(entry.practice);
            }
        } else {
            if !practices_done {
                practices_done = true;
                wrt.write_record(practices)?;
                practices = vec![];
            }
            cob = Some(entry.cob_date);
            wrt.write_record(row)?;
            row = vec![entry.cob_date.to_string(), value_str];
        }
    }
    wrt.write_record(row)?;
    let res = String::from_utf8(wrt.into_inner()?)?;
    Ok(res)
}
