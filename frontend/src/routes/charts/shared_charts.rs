use super::base::ChartsBase;
use crate::{
    components::{
        blank_page::{BlankPage, CalendarProps},
        list_errors::ListErrors,
    },
    hooks::SessionStateContext,
    routes::charts::{Report, SelectedReportId},
    services::{
        get_shared_practices,
        report::{get_shared_report_data, get_shared_reports},
        user_info,
    },
};
use common::ReportDuration;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

#[derive(Properties, Clone, PartialEq)]
pub struct SharedChartsProps {
    pub share_id: AttrValue,
}

#[function_component(SharedCharts)]
pub fn shared_charts(props: &SharedChartsProps) -> Html {
    let session_ctx = use_context::<SessionStateContext>().expect("No session state found");
    let active_report = use_state(|| None::<Report>);
    let duration = use_state(|| ReportDuration::Month);

    let user_info = {
        let share_id = props.share_id.clone();
        use_async(async move { user_info(&share_id).await.map(|inner| inner.user) })
    };

    let reports = {
        let share_id = props.share_id.clone();
        use_async(async move { get_shared_reports(&share_id).await.map(|res| res.reports) })
    };

    let practices = {
        let share_id = props.share_id.clone();
        use_async(async move {
            get_shared_practices(&share_id).await.map(|res| {
                res.user_practices
                    .into_iter()
                    .filter(|p| p.is_active)
                    .collect::<Vec<_>>()
            })
        })
    };

    let report_data = {
        let duration = duration.clone();
        let share_id = props.share_id.clone();
        let session = session_ctx.clone();
        use_async(async move {
            get_shared_report_data(&share_id, &session.selected_date, &duration)
                .await
                .map(|res| res.values)
        })
    };

    {
        // Load state on mount
        let reports = reports.clone();
        let practices = practices.clone();
        let user_info = user_info.clone();
        let report_data = report_data.clone();
        use_mount(move || {
            reports.run();
            practices.run();
            user_info.run();
            report_data.run();
        });
    }

    {
        let report_data = report_data.clone();
        use_effect_with(session_ctx.clone(), move |_| {
            report_data.run();
            || ()
        });
    }

    {
        let active = active_report.clone();
        use_effect_with(reports.clone(), move |reports| {
            active.set(
                reports
                    .data
                    .as_ref()
                    .and_then(|inner| inner.iter().next().cloned()),
            );
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
            if let Some(reports) = reports.data.as_ref() {
                active.set(reports.iter().find(|r| r.id == id.report_id).cloned());
            }
        })
    };

    html! {
        <BlankPage
            loading={reports.loading
                || user_info.loading
                || practices.loading
                || report_data.loading}
            calendar={CalendarProps::no_override_selected_date()}
            header_label={user_info.data.as_ref().map(|u| u.name.to_owned()).unwrap_or_default()}
        >
            <ListErrors error={reports.error.clone()} />
            <ListErrors error={practices.error.clone()} />
            <ListErrors error={report_data.error.clone()} />
            <ListErrors error={user_info.error.clone()} />
            if let Some(report) = active_report.as_ref() {
                if reports.data.is_some() {
                    <ChartsBase
                        reports={reports.data.clone().unwrap_or_default()}
                        practices={practices.data.clone().unwrap_or_default()}
                        report_data={report_data.data.clone().unwrap_or_default()}
                        report={(*report).clone()}
                        {report_onchange}
                        {dates_onchange}
                    />
                }
            }
        </BlankPage>
    }
}
