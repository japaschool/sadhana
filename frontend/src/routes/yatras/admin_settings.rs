use gloo_dialogs::confirm;
use wasm_bindgen_futures::spawn_local;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, draggable_list::DraggableList, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    services::{
        delete_yatra, delete_yatra_practice, get_yatra, get_yatra_practices,
        reorder_yatra_practices, update_yatra_practice,
    },
};

use super::AppRoute;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
}

#[function_component(AdminSettings)]
pub fn admin_settings(props: &Props) -> Html {
    let reload = use_state(|| true);
    let ordered_practices = use_list(vec![]);
    let nav = use_navigator().unwrap();
    let yatra = {
        let yatra_id = props.yatra_id.clone();
        use_async(async move { get_yatra(&yatra_id).await.map(|resp| resp.yatra) })
    };
    let all_practices = {
        let yatra_id = props.yatra_id.to_owned();
        use_async(async move {
            get_yatra_practices(yatra_id.as_str())
                .await
                .map(|res| res.practices)
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

    let reorder_practices = {
        let yatra_id = props.yatra_id.clone();
        let op = ordered_practices.clone();
        use_async(async move {
            reorder_yatra_practices(yatra_id.as_str(), op.current().to_owned()).await
        })
    };

    {
        // This is a hack that forces the state to reload from backend when we redirect
        // to this page after a new practice has been added. Without it (and its use_effect_with_deps)
        // the reload does not happen.
        let all_practices = all_practices.clone();
        use_effect_with_deps(
            move |_| {
                all_practices.run();
                || ()
            },
            reload.clone(),
        );
    }

    {
        // Load state on mount
        let all_practices = all_practices.clone();
        let yatra = yatra.clone();
        use_mount(move || {
            log::debug!("Loading All Practices");
            all_practices.run();
            yatra.run();
        });
    }

    let delete = {
        let all_practices = all_practices.clone();
        let yatra_id = props.yatra_id.clone();
        Callback::from(move |practice: String| {
            log::debug!("Deleting yatra practice {:?}", practice);

            let all_practices = all_practices.clone();
            let yatra_id = yatra_id.clone();
            spawn_local(async move {
                delete_yatra_practice(yatra_id.as_str(), &practice)
                    .await
                    .and_then(|_| Ok(all_practices.run()))
                    .unwrap()
            });
        })
    };

    let rename = {
        let all_practices = all_practices.clone();
        let yatra_id = props.yatra_id.clone();
        Callback::from(move |(from, to): (String, String)| {
            let all_practices = all_practices.clone();
            let yatra_id = yatra_id.clone();

            spawn_local(async move {
                update_yatra_practice(yatra_id.as_str(), &from, &to)
                    .await
                    .and_then(|_| Ok(all_practices.run()))
                    .unwrap()
            });
        })
    };

    let reorder = {
        let op = ordered_practices.clone();
        let rp = reorder_practices.clone();
        Callback::from(move |practices: Vec<String>| {
            op.set(practices);
            rp.run();
        })
    };

    let delete_yatra_onclick = {
        let delete_yatra = delete_yatra.clone();
        Callback::from(move |_: MouseEvent| {
            if confirm(&Locale::current().delete_yatra_warning()) {
                delete_yatra.run();
            }
        })
    };

    html! {
        <BlankPage
            header_label={ yatra.data.iter().map(|y| y.name.clone()).next().unwrap_or_default() }
            prev_link={ (Locale::current().done(), AppRoute::YatraSettings { id: props.yatra_id.to_string() }) }
            loading={ all_practices.loading }>
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={reorder_practices.error.clone()} />
            <div class={ BODY_DIV_CSS }>
                <form>{
                    if all_practices.loading {
                        html!{}
                    } else { html! {
                        <DraggableList
                            items={ all_practices.data
                                .as_ref()
                                .unwrap_or(&vec![])
                                .iter()
                                .map(|p| p.practice.clone())
                                .collect::<Vec<_>>() }
                            toggle_hidden_enabled=false
                            toggle_hidden={ Callback::from(|_|{}) }
                            is_hidden={ Callback::from(|_| false) }
                            rename={ rename.clone() }
                            rename_popup_label={ Locale::current().enter_new_practice_name() }
                            delete={ delete.clone() }
                            delete_popup_label={ Locale::current().delete_yatra_practice_warning() }
                            reorder = { reorder.clone() }
                            />
                    }}}
                </form>
                <div class="flex justify-center">
                    <Link<AppRoute> classes={ LINK_CSS_NEW_ACC }
                        to={AppRoute::NewYatraPractice { id: props.yatra_id.to_string() }}>
                        { Locale::current().add_new_practice() }
                    </Link<AppRoute>>
                </div>
                <div class="relative">
                    <button class={ SUBMIT_BTN_CSS } onclick={ delete_yatra_onclick }>
                    <i class="icon-bin"></i>{ format!(" {}", Locale::current().delete_yatra()) }</button>
                </div>
            </div>
        </BlankPage>
    }
}
