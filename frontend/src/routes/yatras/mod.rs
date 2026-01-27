use common::error::AppError;
use gloo::storage::{LocalStorage, Storage};
use gloo_dialogs::prompt;
use tw_merge::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{
        blank_page::{BlankPage, ButtonType, CalendarProps, HeaderButtonProps},
        grid::*,
        list_errors::ListErrors,
        summary_details::*,
    },
    css::*,
    hooks::{Session, use_cache_aware_async},
    i18n::Locale,
    model::{
        BetterDirection, Bound, ColourZonesConfig, UserYatraData, Value, Yatra, YatraData,
        ZoneColour,
    },
    routes::AppRoute,
    services::{create_yatra, get_user_yatras, get_yatra_data, url},
    tr,
};

pub mod admin_settings;
pub mod join;
pub mod settings;

const SELECTED_YATRA_ID_KEY: &str = "selected_yatra";

#[function_component(Yatras)]
pub fn yatras() -> Html {
    let session_ctx = use_context::<Session>().expect("No session state found");
    let nav = use_navigator().unwrap();
    let yatras = use_async(async move { get_user_yatras().await.map(|y| y.yatras) });
    let selected_yatra = use_state(|| None::<Yatra>);
    let data = {
        let session = session_ctx.clone();
        let selected_yatra = selected_yatra.clone();
        use_cache_aware_async(
            url::get_yatra_data(
                &selected_yatra
                    .as_ref()
                    .map(|y| y.id.to_owned())
                    .unwrap_or_default(),
                &session.selected_date,
            ),
            move |cache_only| {
                let selected_yatra = selected_yatra.clone();
                let session = session.clone();
                async move {
                    if let Some(y) = selected_yatra.as_ref() {
                        get_yatra_data(&y.id, &session.selected_date, cache_only).await
                    } else {
                        Ok(YatraData::default())
                    }
                }
            },
        )
    };
    let new_yatra = use_async(async move {
        if let Some(yatra_name) =
            prompt(&tr!(yatra_new_name_prompt), None).filter(|s| !s.trim().is_empty())
        {
            create_yatra(yatra_name.trim().to_owned())
                .await
                .map(|res| res.yatra)
        } else {
            Err(AppError::UnprocessableEntity(vec![]))
        }
    });

    {
        let yatras = yatras.clone();
        use_mount(move || {
            yatras.run();
        });
    }

    {
        let nav = nav.clone();
        use_effect_with(new_yatra.clone(), move |res| {
            res.data
                .iter()
                .for_each(|y| nav.push(&AppRoute::YatraSettings { id: y.id.clone() }));
            || ()
        });
    }

    {
        let selected = selected_yatra.clone();
        use_effect_with(yatras.clone(), move |all| {
            let yatra = LocalStorage::get::<String>(SELECTED_YATRA_ID_KEY)
                .map(|s| s.replace('\"', ""))
                .ok()
                .and_then(|id| {
                    all.data
                        .iter()
                        .flat_map(|all| all.iter())
                        .find(|y| y.id == id)
                })
                .or(all.data.iter().flat_map(|all| all.iter()).next())
                .cloned();

            log::debug!(
                "Setting selected yatra to {:?}; all yatras: {:?}",
                yatra,
                all.data
            );

            selected.set(yatra);
            || ()
        });
    }

    {
        let data = data.clone();
        use_effect_with((selected_yatra.clone(), session_ctx.clone()), move |_| {
            data.run();
            || ()
        });
    }

    let yatra_onchange = {
        let selected = selected_yatra.clone();
        let yatras = yatras.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();
            let yatra = yatras
                .data
                .iter()
                .flat_map(|inner| inner.iter())
                .find(|y| y.name == input.value())
                .cloned();

            yatra.iter().for_each(|y| {
                LocalStorage::set(SELECTED_YATRA_ID_KEY, y.id.clone()).unwrap();
            });

            selected.set(yatra);
        })
    };

    let create_yatra_onclick = {
        let create = new_yatra.clone();
        Callback::from(move |_: MouseEvent| {
            create.run();
        })
    };

    let grid_header = {
        let mut hd = data
            .data
            .iter()
            .flat_map(|d| d.practices.iter())
            .map(|p| p.practice.clone())
            .collect::<Vec<_>>();
        hd.insert(0, tr!(yatra_7d_trend_column));
        hd.insert(0, tr!(yatra_sadhaka_column_value));
        hd
    };

    let grid_colour_coding = {
        let mut confs = data
            .data
            .iter()
            .flat_map(|d| d.practices.iter())
            .map(|p| p.colour_zones.clone())
            .collect::<Vec<_>>();
        confs.insert(0, None); // trend column
        confs.insert(0, None); // name column
        confs
    };

    let grid_data = || {
        data.data
            .iter()
            .flat_map(|d| d.data.iter())
            .map(
                |UserYatraData {
                     user_id: _,
                     user_name,
                     row,
                     trend_arrow,
                     stability_heatmap: _,
                 }| {
                    let mut data_columns = row.clone();
                    data_columns.insert(
                        0,
                        Some(Value::Text(
                            trend_arrow.map(|a| a.to_string()).unwrap_or_default(),
                        )),
                    );
                    data_columns.insert(0, Some(Value::Text(user_name.clone())));
                    data_columns
                },
            )
            .collect::<Vec<Vec<_>>>()
    };

    let heatmap_colour_coding = {
        let mut res = vec![
            Some(ColourZonesConfig {
                better_direction: BetterDirection::Higher,
                bounds: vec![
                    // TODO:
                    // Bound::new(Some(Value::Int(50)), ZoneColour::MutedRed),
                    // Bound::new(Some(Value::Int(70)), ZoneColour::SoftRed),
                    // Bound::new(Some(Value::Int(95)), ZoneColour::Yellow),
                    // Bound::new(Some(Value::Int(105)), ZoneColour::Green),
                    Bound::new(Some(Value::Int(10)), ZoneColour::MutedRed),
                    Bound::new(Some(Value::Int(15)), ZoneColour::Red),
                    Bound::new(Some(Value::Int(30)), ZoneColour::Yellow),
                    Bound::new(Some(Value::Int(40)), ZoneColour::Green),
                ],
                no_value_colour: ZoneColour::Neutral,
                best_colour: Some(ZoneColour::DarkGreen)
            });
            14
        ];
        res.insert(0, None); // name column
        res
    };

    let heatmap_header = {
        let mut res = data
            .data
            .iter()
            .flat_map(|d| {
                let days = &d.stability_heatmap_days;
                let range = if session_ctx.today_selected() {
                    0..days.len().saturating_sub(1)
                } else {
                    1..days.len()
                };
                days.get(range).into_iter().flatten()
            })
            .map(ToString::to_string)
            .collect::<Vec<_>>();
        res.insert(0, tr!(yatra_sadhaka_column_value));
        res
    };

    let heatmap_data = || {
        data.data
            .iter()
            .flat_map(|d| d.data.iter())
            .map(|d| {
                let mut row: Vec<_> = if session_ctx.today_selected() {
                    &d.stability_heatmap[..d.stability_heatmap.len() - 1]
                } else {
                    &d.stability_heatmap[1..]
                }
                .iter()
                .map(|v| (*v > 0).then_some(Value::Int(*v as u16)))
                .collect();
                row.insert(0, Some(Value::Text(d.user_name.clone())));
                row
            })
            .collect::<Vec<Vec<_>>>()
    };

    let empty_body = html! {
        <div class={BODY_DIV_CSS}>
            <ListErrors error={yatras.error.clone()} />
            <span>{ tr!(yatra_blank_msg) }</span>
            <div class="relative">
                <div class={LINKS_CSS}>
                    <a class={LINK_CSS} onclick={create_yatra_onclick.clone()}>
                        { tr!(yatra_create) }
                    </a>
                </div>
            </div>
        </div>
    };

    let grid_body = html! {
        <>
            <ListErrors error={yatras.error.clone()} />
            <ListErrors error={data.error.clone()} />
            <ListErrors error={new_yatra.error.clone()} />
            <div class={BODY_DIV_CSS}>
                <div class="relative pb-5">
                    <select
                        class={tw_merge!(INPUT_CSS, "appearance-none")}
                        id="yatra"
                        onchange={yatra_onchange}
                        required=true
                    >
                        { yatras.data
                            .iter()
                            .flat_map(|inner| inner.iter())
                            .map(|y| {
                                let selected = selected_yatra.iter().any(|y2| y2 == y);
                                html! { <option class="text-black" { selected } >{ y.name.clone() }</option> }
                            })
                            .collect::<Html>() }
                    </select>
                    <label for="yatra" class={INPUT_LABEL_CSS}>
                        <i class="icon-user-group" />
                        { format!(" {}: ", tr!(yatra)) }
                    </label>
                </div>
            </div>
            <Grid header={grid_header} data={grid_data()} color_coding={grid_colour_coding} />
            <SummaryDetails label={tr!(yatra_heatmap_label)} open=true>
                <Grid
                    header={heatmap_header}
                    data={heatmap_data()}
                    color_coding={heatmap_colour_coding}
                    heatmap=true
                />
            </SummaryDetails>
            if data.data.iter().any(|inner| !inner.statistics.is_empty()) {
                <div class={BODY_DIV_BASE_CSS}>
                    <SummaryDetails label={tr!(yatra_stats_label)} open=true>
                        <div class={tw_merge!(TWO_COLS_CSS, "gap-x-4 gap-y-2")}>
                            { for data.data.iter().flat_map(|inner| inner.statistics.iter()).map(|stat| html! {
                                <div class="relative flex justify-between">
                                    <label>{ format!("{}: ", stat.label) }</label>
                                    <label class="font-extrabold">
                                        { stat.value
                                            .as_ref()
                                            .map(|v|v.to_string())
                                            .unwrap_or(tr!(yatra_stats_empty_value))
                                        }
                                    </label>
                                </div>
                            }) }
                        </div>
                    </SummaryDetails>
                </div>
            }
        </>
    };

    html! {
        <BlankPage
            show_footer=true
            selected_page={AppRoute::Yatras}
            loading={yatras.loading || data.loading}
            left_button={HeaderButtonProps::blank()}
            right_button={if let Some(yatra) = selected_yatra.as_ref() {
                    HeaderButtonProps::new_redirect(
                        tr!(settings),
                        AppRoute::YatraSettings { id: yatra.id.clone() },
                        None,
                        ButtonType::Button
                    )
                } else {
                    HeaderButtonProps::blank()
                }}
            calendar={CalendarProps::no_override_selected_date()}
        >
            { if !yatras.loading
                    && yatras
                        .data
                        .iter()
                        .flat_map(|inner| inner.iter())
                        .next()
                        .is_none()
                {
                    empty_body
                } else {
                    grid_body
                } }
        </BlankPage>
    }
}
