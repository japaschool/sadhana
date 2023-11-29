use super::{SelectedReportId, SELECTED_REPORT_ID_KEY};
use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        list_errors::ListErrors,
    },
    css::*,
    i18n::Locale,
    routes::charts::ReportForm,
    services::report::create_new_report,
};
use gloo::storage::{LocalStorage, Storage};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_async;
use yew_router::prelude::use_navigator;

enum ReportType {
    Graph,
    Grid,
}

#[function_component(CreateReport)]
pub fn create_report() -> Html {
    let report_name = use_state(String::default);
    let report_type = use_state(|| ReportType::Graph);
    let nav = use_navigator().unwrap();

    let create = {
        let report_name = report_name.clone();
        let report_type = report_type.clone();
        let nav = nav.clone();
        use_async(async move {
            let report = match *report_type {
                ReportType::Graph => ReportForm::default_graph(&*report_name),
                ReportType::Grid => ReportForm::default_grid(&*report_name),
            };
            create_new_report(report)
                .await
                .map(|res| {
                    LocalStorage::set(SELECTED_REPORT_ID_KEY, SelectedReportId::new(res.report_id))
                        .unwrap()
                })
                .map(|_| nav.back())
        })
    };

    let report_type_onchange = {
        let report_type = report_type.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();

            let new_type = match input.value().as_str() {
                "graph" => ReportType::Graph,
                "grid" => ReportType::Grid,
                _ => unreachable!(),
            };

            report_type.set(new_type);
        })
    };

    let report_name_oninput = {
        let report_name = report_name.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            report_name.set(input.value());
        })
    };

    let onsubmit = {
        let create = create.clone();
        Callback::from(move |_| {
            create.run();
        })
    };

    html! {
        <form {onsubmit}>
            <BlankPage
                show_footer=false
                loading={create.loading}
                header_label={Locale::current().report_add_new()}
                left_button={HeaderButtonProps::back()}
                right_button={HeaderButtonProps::submit(Locale::current().save())}
                >
                <ListErrors error={create.error.clone()} />
                <div class={BODY_DIV_CSS}>
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="Name"
                            value={(*report_name).clone()}
                            id={"report_name"}
                            oninput={report_name_oninput}
                            class={INPUT_CSS}
                            required=true
                            autocomplete="off"
                            />
                        <label for={"report_name"} class={INPUT_LABEL_CSS}>
                            {Locale::current().report_name()}
                        </label>
                    </div>
                    <div class="relative">
                        <select class={INPUT_CSS} id={"report_type"} onchange={report_type_onchange}>
                            <option class={"text-black"} value={"graph"} selected=true>{Locale::current().report_type_graph()}</option>
                            <option class={"text-black"} value={"grid"}>{Locale::current().report_type_grid()}</option>
                        </select>
                        <label for={"report_type"} class={INPUT_LABEL_CSS}>
                            {format!(" {}: ",Locale::current().report_type())}
                        </label>
                    </div>
                </div>
            </BlankPage>
        </form>
    }
}
