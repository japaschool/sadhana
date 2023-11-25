use std::{collections::HashMap, error::Error, str::FromStr};

use super::base::ChartsBase;
use crate::{
    components::{
        blank_page::BlankPage,
        chart::{self, Chart, Graph, LineConf},
        clipboard_copy_button::CopyButton,
        grid::*,
        list_errors::ListErrors,
    },
    css::*,
    hooks::use_user_context,
    i18n::{Locale, DAYS},
    model::{PracticeDataType, PracticeEntryValue, ReportData, ReportDataEntry, UserPractice},
    routes::AppRoute,
    services::{
        get_chart_data, get_shared_chart_data, get_shared_practices, get_user_practices, user_info,
    },
};
use chrono::Datelike;
use chrono::Local;
use common::ReportDuration;
use csv::Writer;
use gloo::storage::{LocalStorage, Storage};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::spawn_local;
use web_sys::{BlobPropertyBag, HtmlElement, HtmlInputElement};
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};

#[derive(Properties, Clone, PartialEq)]
pub struct SharedChartsProps {
    pub share_id: AttrValue,
}

#[function_component(SharedCharts)]
pub fn shared_charts(props: &SharedChartsProps) -> Html {
    let user_info = {
        let share_id = props.share_id.clone();
        use_async(async move { user_info(&share_id).await.map(|inner| inner.user) })
    };

    let all_practices = {
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

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        let user_info = user_info.clone();
        use_mount(move || {
            all_practices.run();
            user_info.run();
        });
    }

    let selected_practice = use_state(|| None as Option<UserPractice>);
    let duration = use_state(|| ReportDuration::Last30Days);

    let report_data = {
        let practice = selected_practice.clone();
        let duration = duration.clone();
        let share_id = props.share_id.clone();
        use_async(async move {
            match &*practice {
                //FIXME: change to return data for all practices
                Some(p) => get_shared_chart_data(&share_id, &p.practice, &*duration)
                    .await
                    .map(|res| res.values),
                None => Ok(vec![]),
            }
        })
    };

    let pull_data = {
        let report_data = report_data.clone();
        let duration = duration.clone();
        let selected_practice = selected_practice.clone();
        Callback::from(move |(practice, dur)| {
            duration.set(dur);
            selected_practice.set(Some(practice));
            report_data.run();
        })
    };

    html! {
            <BlankPage
                loading={all_practices.loading || user_info.loading}
                header_label={user_info.data.as_ref().map(|u| u.name.to_owned()).unwrap_or_default()}
                >
                <ListErrors error={all_practices.error.clone()} />
                <ListErrors error={report_data.error.clone()} />
                if all_practices.data.is_some(){
                    <ChartsBase
                        practices={all_practices.data.clone().unwrap_or_default()}
                        report_data={report_data.data.clone().unwrap_or_default()}
                        {pull_data}/>
            }
            </BlankPage>
    }
}
