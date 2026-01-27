use gloo_dialogs::confirm;
use strum::IntoEnumIterator;
use tw_merge::*;
use wasm_bindgen_futures::spawn_local;
use web_sys::{HtmlElement, HtmlInputElement};
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        draggable_list::{DraggableList, Item},
        list_errors::ListErrors,
        share_link::{ShareLink, can_share, emit_signal_callback, set_signal_callback},
        summary_details::SummaryDetails,
    },
    css::*,
    hooks::use_cache_aware_async,
    i18n::*,
    model::{Aggregation, PracticeDataType, TimeRange, Yatra, YatraStatistic, YatraStatistics},
    services::{
        delete_yatra, delete_yatra_practice, delete_yatra_user, get_yatra, get_yatra_practices,
        get_yatra_users, reorder_yatra_practices, toggle_is_admin_yatra_user, update_yatra,
    },
    tr,
};

use super::AppRoute;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
}

#[function_component(AdminSettings)]
pub fn admin_settings(props: &Props) -> Html {
    let reload = use_state(|| true);
    let yatra_state = use_state(Yatra::default);
    let stats_config = use_state(YatraStatistics::default);
    let ordered_practices = use_list(vec![]);
    let nav = use_navigator().unwrap();
    let action_user_id = use_mut_ref(|| None::<String>);
    let share_signal = use_state(|| None::<Callback<_>>);

    let can_share = can_share();

    //-------------------------------------------------------------------------

    let yatra = use_cache_aware_async(get_yatra(&props.yatra_id).map(|resp| resp.yatra));

    let all_practices = use_cache_aware_async(
        get_yatra_practices(props.yatra_id.as_str()).map(|res| res.practices),
    );

    let members =
        use_cache_aware_async(get_yatra_users(props.yatra_id.as_str()).map(|res| res.users));

    let delete_member = {
        let yatra_id = props.yatra_id.to_owned();
        let user_id = action_user_id.clone();
        use_async(async move {
            let user_id = user_id.borrow().to_owned();
            if let Some(user_id) = user_id {
                delete_yatra_user(yatra_id.as_str(), &user_id).await
            } else {
                Ok(())
            }
        })
    };

    let toggle_is_admin = {
        let yatra_id = props.yatra_id.to_owned();
        let user_id = action_user_id.clone();
        use_async(async move {
            let user_id = user_id.borrow().to_owned();
            if let Some(user_id) = user_id {
                toggle_is_admin_yatra_user(yatra_id.as_str(), &user_id).await
            } else {
                Ok(())
            }
        })
    };

    let delete_yatra = {
        let yatra_id = props.yatra_id.clone();
        let nav = nav.clone();
        use_async(async move {
            delete_yatra(yatra_id.as_str())
                .await
                .map(|_| nav.push(&AppRoute::Yatras))
        })
    };

    let update_yatra = {
        let yatra_id = props.yatra_id.clone();
        let mut yatra = (*yatra_state).clone();
        yatra.statistics = (!stats_config.statistics.is_empty()).then_some((*stats_config).clone());
        use_async(async move { update_yatra(yatra_id.as_str(), yatra).await })
    };

    let reorder_practices = {
        let yatra_id = props.yatra_id.clone();
        let op = ordered_practices.clone();
        use_async(async move {
            let op = op.current().to_owned();
            reorder_yatra_practices(yatra_id.as_str(), op).await
        })
    };

    //-------------------------------------------------------------------------

    {
        // This is a hack that forces the state to reload from backend when we redirect
        // to this page after a new practice has been added. Without it (and its use_effect_with_deps)
        // the reload does not happen.
        let all_practices = all_practices.clone();
        let members = members.clone();
        use_effect_with(reload.clone(), move |_| {
            all_practices.run();
            members.run();
            || ()
        });
    }

    {
        let members = members.clone();
        use_effect_with(
            (toggle_is_admin.clone(), delete_member.clone()),
            move |_| {
                members.run();
                || ()
            },
        )
    }

    {
        let nav = nav.clone();
        let route = AppRoute::YatraSettings {
            id: props.yatra_id.to_string(),
        };
        use_effect_with(update_yatra.clone(), move |res| {
            if res.data.is_some() {
                nav.push(&route);
            }
            || ()
        });
    }

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        let members = members.clone();
        let yatra = yatra.clone();
        use_mount(move || {
            all_practices.run();
            yatra.run();
            members.run();
        });
    }

    {
        let stats_config = stats_config.clone();
        let yatra_state = yatra_state.clone();
        use_effect_with(yatra.clone(), move |yatra| {
            if let Some(yatra) = yatra.data.as_ref() {
                yatra_state.set(yatra.clone());
                if let Some(conf) = &yatra.statistics {
                    stats_config.set(conf.clone());
                }
            }
            || ()
        });
    }

    //-------------------------------------------------------------------------

    let is_good_for_practice = |agg: &Aggregation, practice_id: &str| {
        all_practices
            .data
            .as_ref()
            .and_then(|practices| {
                practices
                    .iter()
                    .find(|p| p.id == practice_id)
                    .map(|p| p.data_type.to_owned())
            })
            .map(|dt| match dt {
                PracticeDataType::Int | PracticeDataType::Duration => true,
                PracticeDataType::Time => *agg != Aggregation::Sum,
                _ => *agg == Aggregation::Count,
            })
            .unwrap_or(*agg == Aggregation::Count)
    };

    //-------------------------------------------------------------------------

    let delete = {
        let all_practices = all_practices.clone();
        let yatra_id = props.yatra_id.clone();
        Callback::from(move |practice_id: String| {
            log::debug!("Deleting yatra practice {:?}", practice_id);

            let all_practices = all_practices.clone();
            let yatra_id = yatra_id.clone();
            spawn_local(async move {
                delete_yatra_practice(yatra_id.as_str(), &practice_id)
                    .await
                    .map(|_| all_practices.run())
                    .unwrap()
            });
        })
    };

    let yatra_name_onchange = {
        let yatra_state = yatra_state.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_yatra = (*yatra_state).clone();
            new_yatra.name = input.value();
            yatra_state.set(new_yatra);
        })
    };

    let edit_practice = {
        let nav = nav.clone();
        let yatra = yatra.clone();
        Callback::from(move |(id, _): (String, String)| {
            nav.push(&AppRoute::EditYatraPractice {
                id: yatra
                    .data
                    .as_ref()
                    .map(|y| y.id.clone())
                    .unwrap_or_default(),
                practice_id: id,
            });
        })
    };

    let reorder = {
        let op = ordered_practices.clone();
        let rp = reorder_practices.clone();
        Callback::from(move |practices: Vec<Item>| {
            op.set(
                practices
                    .iter()
                    .map(|Item { id, name: _ }| id.to_owned())
                    .collect(),
            );
            rp.run();
        })
    };

    let delete_yatra_onclick = {
        let delete_yatra = delete_yatra.clone();
        Callback::from(move |_: MouseEvent| {
            if confirm(&tr!(yatra_delete_warning)) {
                delete_yatra.run();
            }
        })
    };

    let new_yatra_practice_onclick = {
        let nav = nav.clone();
        let yatra_id = props.yatra_id.clone();
        Callback::from(move |_: MouseEvent| {
            nav.push(&AppRoute::NewYatraPractice {
                id: yatra_id.to_string(),
            });
        })
    };

    let delete_member_onclick = {
        let user_id = action_user_id.clone();
        let delete_member = delete_member.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            if confirm(&tr!(yatra_delete_member_confirmation)) {
                let input: HtmlElement = e.target_unchecked_into();
                user_id.replace(Some(input.id()));
                delete_member.run();
            }
        })
    };

    let toggle_is_admin_onclick = {
        let user_id = action_user_id.clone();
        let toggle_is_admin = toggle_is_admin.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            let input: HtmlElement = e.target_unchecked_into();
            user_id.replace(Some(input.id()));
            toggle_is_admin.run();
        })
    };

    let update_stats_state = |f: fn(&mut YatraStatistic, String)| {
        let stats_config = stats_config.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let v = input.value();
            let idx: usize = input
                .id()
                .parse()
                .unwrap_or_else(|_| panic!("Failed to parse index from id {}", input.id()));
            let mut new_config = (*stats_config).clone();
            if let Some(stat) = new_config.statistics.get_mut(idx) {
                f(stat, v);
            }
            stats_config.set(new_config);
        })
    };

    let stats_visibility_onchange = {
        let stats_config = stats_config.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_config = (*stats_config).clone();
            new_config.visible_to_all = input.value() == "Everyone";
            stats_config.set(new_config);
        })
    };

    let stats_label_onchange = update_stats_state(|stat, v| stat.label = v);

    let stats_practice_onchange = update_stats_state(|stat, v| {
        stat.practice_id = v;
        stat.aggregation = Default::default();
    });

    let aggregation_onchange = update_stats_state(|stat, v| {
        if let Ok(agg) = v.parse() {
            stat.aggregation = agg;
        }
    });

    let stats_time_range_onchange = update_stats_state(|stat, v| {
        if let Ok(tr) = v.parse() {
            stat.time_range = tr;
        }
    });

    let stats_delete_onclick = {
        let stats_config = stats_config.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            let input: HtmlElement = e.target_unchecked_into();
            let idx: usize = input
                .id()
                .parse()
                .unwrap_or_else(|_| panic!("Failed to parse index from id {}", input.id()));
            let mut new_config = (*stats_config).clone();
            if idx < new_config.statistics.len() {
                new_config.statistics.remove(idx);
            }
            stats_config.set(new_config);
        })
    };

    let add_stat_onclick = {
        let stats_config = stats_config.clone();
        Callback::from(move |_: MouseEvent| {
            let mut new_config = (*stats_config).clone();
            new_config.statistics.push(Default::default());
            stats_config.set(new_config);
        })
    };

    let checkbox_onclick = {
        let state = yatra_state.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();

            let mut new_state = (*state).clone();
            new_state.show_stability_metrics = input.checked();
            state.set(new_state);
        })
    };

    //-------------------------------------------------------------------------

    let visibility_options = [
        tr!(yatra_stats_visibility_admins),
        tr!(yatra_stats_visibility_everyone),
    ];

    html! {
        <BlankPage
            left_button={HeaderButtonProps::done(AppRoute::YatraSettings { id: props.yatra_id.to_string(), })}
            loading={all_practices.loading || members.loading}
        >
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={members.error.clone()} />
            <ListErrors error={toggle_is_admin.error.clone()} />
            <ListErrors error={delete_member.error.clone()} />
            <ListErrors error={reorder_practices.error.clone()} />
            <ListErrors error={update_yatra.error.clone()} />
            <ListErrors error={delete_yatra.error.clone()} />
            <form
                onsubmit={let update_yatra = update_yatra.clone();
                    Callback::from(move |_: SubmitEvent| {
                        update_yatra.run();
                    })}
            >
                <div class={tw_merge!(BODY_DIV_BASE_CSS, "mx-auto max-w-md")}>
                    <SummaryDetails open=true label={tr!(yatra_general)}>
                        <div class={BODY_DIV_CSS}>
                            <div class="relative">
                                <input
                                    onchange={yatra_name_onchange}
                                    type="text"
                                    id="yatra_name"
                                    value={yatra_state.name.clone()}
                                    placeholder="yatra_name"
                                    autocomplete="off"
                                    required=true
                                    class={tw_merge!(INPUT_CSS, "text-center")}
                                />
                                <label for="yatra_name" class={INPUT_LABEL_CSS}>
                                    <i class="icon-doc" />
                                    { tr!(yatra_name_label) }
                                </label>
                            </div>
                            <div>
                                <label class="flex justify-between whitespace-nowrap pl-2 pr-2">
                                    <span class="">
                                        <i class="icon-tick" />
                                        { tr!(yatra_show_stability) }
                                    </span>
                                    <div class="flex">
                                        <input
                                            type="checkbox"
                                            class={CHECKBOX_INPUT_CSS}
                                            onclick={checkbox_onclick}
                                            checked={yatra_state.show_stability_metrics}
                                        />
                                    </div>
                                </label>
                                <div class="pt-2">
                                    <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                        { tr!(yatra_heatmap_memo_p1) }
                                    </p>
                                    <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                        { tr!(yatra_heatmap_memo_p2) }
                                    </p>
                                    <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                        { tr!(yatra_heatmap_memo_p3) }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </SummaryDetails>
                    if !all_practices.loading {
                        <SummaryDetails open=true label={tr!(yatra_practices)}>
                            <DraggableList
                                items={all_practices.data
                                    .as_ref()
                                    .unwrap_or(&vec![])
                                    .iter()
                                    .map(|p| Item { id: p.id.clone(), name: p.practice.clone() })
                                    .collect::<Vec<_>>()}
                                toggle_hidden_enabled=false
                                toggle_hidden={Callback::from(|_|{})}
                                is_hidden={Callback::from(|_| false)}
                                rename={edit_practice}
                                request_new_name=false
                                rename_popup_label={tr!(enter_new_practice_name)}
                                delete={delete.clone()}
                                delete_popup_label={tr!(yatra_delete_practice_warning)}
                                reorder={reorder.clone()}
                            />
                            <div>
                                <button class={BTN_CSS} onclick={new_yatra_practice_onclick}>
                                    <i class="icon-plus" />
                                    { tr!(add_new_practice) }
                                </button>
                            </div>
                        </SummaryDetails>
                        <SummaryDetails label={tr!(yatra_members)}>
                            { for members
                                    .data.as_ref()
                                    .unwrap_or(&vec![])
                                    .iter()
                                    .enumerate()
                                    .map( |(idx, user)| html! {
                            <div class="flex w-full justify-center align-baseline">
                                <label
                                    class="flex w-full justify-between whitespace-nowrap mb-6"
                                    id={idx.to_string()}
                                    >
                                    <span>{user.user_name.clone()}</span>
                                </label>
                                <div
                                    class={format!("cursor-pointer text-sm mx-1 pt-1 {}", if user.is_admin {"text-amber-500"} else {""})}
                                    onclick={toggle_is_admin_onclick.clone()}
                                    id={user.user_id.clone()}
                                    >
                                    {tr!(yatra_admin_label)}
                                </div>
                                <label>
                                    <i onclick={delete_member_onclick.clone()} id={user.user_id.clone()} class="cursor-pointer icon-bin"/>
                                </label>
                            </div>
                            }) }
                        </SummaryDetails>
                        <SummaryDetails label={tr!(yatra_stats_section_label)}>
                            <div
                                class={tw_merge!(if stats_config.statistics.is_empty() { BODY_DIV_CSS } else { BODY_DIV_BASE_CSS }, "pt-8")}
                            >
                                <div class="relative">
                                    <select
                                        onchange={stats_visibility_onchange}
                                        id="visibility"
                                        class={tw_merge!(
                                                INPUT_CSS,
                                                "appearance-none text-center [text-align-last:center] has-value",
                                            )}
                                    >
                                        { for visibility_options.iter().enumerate().map(|(i, option)| html! {
                                            <option value={ option.clone() } selected={ stats_config.visible_to_all && i == 1 } >{ option.clone() }</option>
                                        }) }
                                    </select>
                                    <label for="visibility" class={INPUT_SELECT_LABEL_CSS}>
                                        <i class="icon-rounds" />
                                        { tr!(yatra_stats_visible_to) }
                                    </label>
                                </div>
                                { for stats_config.statistics.iter().enumerate().map(|(idx, stat)| html! {
                                    <SummaryDetails
                                        label={
                                            if stat.label.is_empty() {
                                                tr!(yatra_stats_stat_heading, Index(&(idx + 1).to_string()))
                                            } else {
                                                stat.label.clone()
                                            }}
                                        open={ stat.label.is_empty() || stat.practice_id.is_empty() }
                                    >
                                        <div id={idx.to_string()} class={BODY_DIV_CSS}>
                                            <div class="relative">
                                                <input
                                                    onchange={stats_label_onchange.clone()}
                                                    type="text"
                                                    id={idx.to_string()}
                                                    value={stat.label.to_owned()}
                                                    placeholder="label"
                                                    autocomplete="off"
                                                    required=true
                                                    class={tw_merge!(INPUT_CSS, "text-center")}
                                                />
                                                <label for={idx.to_string()} class={INPUT_LABEL_CSS}>
                                                    <i class="icon-rounds"/>
                                                    { tr!(yatra_stats_stat_label) }
                                                </label>
                                            </div>
                                            <div class="relative">
                                                <select
                                                    onchange={stats_practice_onchange.clone()}
                                                    id={idx.to_string()}
                                                    required=true
                                                    class={
                                                        tw_merge!(
                                                            INPUT_CSS,
                                                            "appearance-none text-center [text-align-last:center]",
                                                            if !stat.practice_id.is_empty() { "has-value" } else { "" }
                                                        )
                                                    }
                                                >
                                                    <option class="text-black"
                                                        value=""
                                                        disabled=true
                                                        style="display: none"
                                                        selected={ stat.practice_id.is_empty() }
                                                    />
                                                    { for all_practices.data.iter().flat_map(|inner| inner.iter()).map(|p| {
                                                        html! {
                                                            <option value={ p.id.to_owned() } selected={ p.id == stat.practice_id }>{ p.practice.as_str() }</option>
                                                        }
                                                    }) }
                                                </select>
                                                <label for={idx.to_string()} class={INPUT_SELECT_LABEL_CSS}>
                                                    <i class="icon-rounds"/>
                                                    { tr!(yatra_stats_practice_label) }
                                                </label>
                                            </div>
                                            <div class="relative">
                                                <select
                                                    onchange={aggregation_onchange.clone()}
                                                    id={idx.to_string()}
                                                    required=true
                                                    class={
                                                        tw_merge!(
                                                            INPUT_CSS,
                                                            "appearance-none text-center [text-align-last:center] has-value",
                                                        )
                                                    }
                                                >
                                                    { for Aggregation::iter().filter(|agg| is_good_for_practice(agg, &stat.practice_id)).map(|agg| {
                                                        html! {
                                                            <option value={ agg.to_string() } selected={ agg == stat.aggregation }>{ agg.to_localised_string() }</option>
                                                        }
                                                    }) }
                                                </select>
                                                <label for={idx.to_string()} class={INPUT_SELECT_LABEL_CSS}>
                                                    <i class="icon-rounds"/>
                                                    { tr!(yatra_stats_agg_label) }
                                                </label>
                                            </div>
                                            <div class="relative">
                                                <select
                                                    onchange={stats_time_range_onchange.clone()}
                                                    id={ idx.to_string() }
                                                    required=true
                                                    class={
                                                        tw_merge!(
                                                            INPUT_CSS,
                                                            "appearance-none text-center [text-align-last:center] has-value",
                                                        )
                                                    }
                                                >
                                                    { for TimeRange::iter().map(|tr| {
                                                        html! {
                                                            <option value={ tr.to_string() } selected={ tr == stat.time_range }>{ tr.to_localised_string() }</option>
                                                        }
                                                    }) }
                                                </select>
                                                <label for={ idx.to_string() } class={ INPUT_SELECT_LABEL_CSS }>
                                                    <i class="icon-rounds"/>
                                                    { tr!(yatra_stats_time_range_label) }
                                                </label>
                                            </div>
                                            <div>
                                                <button type="button" id={ idx.to_string() } class={ BTN_CSS } onclick={ stats_delete_onclick.clone() }>
                                                    <i class="icon-bin" />
                                                    { tr!(yatra_stats_delete_stat) }
                                                </button>
                                            </div>
                                        </div>
                                    </SummaryDetails>
                                }) }
                                <div>
                                    <button
                                        type="button"
                                        class={BTN_CSS}
                                        onclick={add_stat_onclick}
                                    >
                                        <i class="icon-plus" />
                                        { tr!(yatra_stats_add_stat) }
                                    </button>
                                </div>
                            </div>
                        </SummaryDetails>
                    }
                    <div
                        class="relative"
                    >
                        <button
                            type="button"
                            onclick={emit_signal_callback(&share_signal)}
                            class={BTN_CSS}
                        >
                            <i class={if can_share {"icon-share"} else {"icon-doc-dup"}} />
                            { if can_share {tr!(yatra_share_join_link)} else {tr!(yatra_copy_join_link)} }
                        </button>
                        <ShareLink
                            relative_link={format!("/yatra/{}/join", props.yatra_id.as_str())}
                            run_signal={set_signal_callback(&share_signal)}
                        />
                    </div>
                    <div class={tw_merge!(TWO_COLS_NO_GAP_CSS, "gap-x-8")}>
                        <button class={BTN_CSS} onclick={delete_yatra_onclick}>
                            <i class="icon-bin" />
                            { tr!(yatra_delete) }
                        </button>
                        <button class={SUBMIT_BTN_CSS}>
                            <i class="icon-save" />
                            { tr!(save) }
                        </button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
