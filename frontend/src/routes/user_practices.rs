use std::collections::HashMap;

use wasm_bindgen_futures::spawn_local;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_map, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{
        blank_page::BlankPage,
        draggable_list::{DraggableList, Item},
        list_errors::ListErrors,
    },
    css::*,
    i18n::Locale,
    model::UserPractice,
    services::{
        delete_user_practice, get_user_practices, reorder_user_practices, update_user_practice,
    },
};

use super::AppRoute;

#[function_component(UserPractices)]
pub fn user_practices() -> Html {
    let nav = use_navigator().unwrap();
    let ordered_practices = use_list(vec![]);
    let local_practices = use_map(HashMap::default());

    let server_practices =
        use_async(async move { get_user_practices().await.map(|res| res.user_practices) });

    let reorder_practices = {
        let op = ordered_practices.clone();
        use_async(async move { reorder_user_practices(op.current().as_ref()).await })
    };

    {
        // Load state on mount
        let server_practices = server_practices.clone();
        use_mount(move || {
            log::debug!("Loading All Practices");
            server_practices.run();
        });
    }

    {
        let local = local_practices.clone();
        use_effect_with_deps(
            move |practices| {
                log::debug!("All Practices loaded. Initialising active practices");

                local.set(
                    practices
                        .data
                        .iter()
                        .flat_map(|inner| inner.iter())
                        .map(|p| (p.id.clone(), p.to_owned()))
                        .collect(),
                );
                || ()
            },
            server_practices.clone(),
        );
    }

    let is_hidden = {
        let local = local_practices.clone();
        Callback::from(move |id: String| !local.current().get(&id).unwrap().is_active)
    };

    let toggle_hidden = {
        let local = local_practices.clone();
        Callback::from(move |id: String| {
            let updated = {
                let current = local.current().get(&id).unwrap().clone();

                UserPractice {
                    is_active: !current.is_active,
                    ..current
                }
            };

            {
                let local = local.clone();
                spawn_local(async move {
                    update_user_practice(&updated)
                        .await
                        .map(|_| local.update(&id, updated))
                        .unwrap()
                });
            }
        })
    };

    let delete = {
        let server_practices = server_practices.clone();
        Callback::from(move |id: String| {
            log::debug!("Deleting user practice {:?}", id);

            {
                let server_practices = server_practices.clone();
                spawn_local(async move {
                    delete_user_practice(&id)
                        .await
                        .map(|_| {
                            server_practices.run();
                        })
                        .unwrap()
                });
            }
        })
    };

    let rename = {
        let nav = nav.clone();
        Callback::from(move |(practice, _): (String, String)| {
            nav.push(&AppRoute::EditUserPractice { practice });
        })
    };

    let reorder = {
        let op = ordered_practices.clone();
        let rp = reorder_practices.clone();
        Callback::from(move |practices: Vec<Item>| {
            op.set(practices.iter().map(|i| i.id.clone()).collect());
            rp.run();
        })
    };

    html! {
            <BlankPage
                header_label={Locale::current().select_practices()}
                prev_link={(Locale::current().done(), AppRoute::Home)}
                show_footer=true
                loading={server_practices.loading}>
                <ListErrors error={server_practices.error.clone()} />
                <ListErrors error={reorder_practices.error.clone()} />
                <div class={format!("space-y-10 {}", BODY_DIV_CSS)}>
                    <form>{
                        if server_practices.loading || local_practices.current().is_empty() {
                            html!{}
                    } else {html! {
                            <DraggableList
                                items={server_practices
                                    .data
                                    .as_ref()
                                    .unwrap_or(&vec![])
                                    .iter()
                                    .map(|p|
                                        Item {
                                            id: p.id.clone(),
                                            name: local_practices
                                                .current()
                                                .get(&p.id)
                                                .unwrap()
                                                .practice
                                                .clone()
                                    })
                                    .collect::<Vec<_>>()
                            }
                                toggle_hidden={toggle_hidden.clone()}
                                is_hidden={is_hidden.clone()}
                                rename={rename.clone()}
                                rename_popup_label={Locale::current().enter_new_practice_name()}
                                request_new_name=false
                                delete={delete.clone()}
                                delete_popup_label={Locale::current().delete_practice_warning()}
                                reorder={reorder.clone()}
                                />
                    }}}
                    </form>
                    <div class="flex justify-center">
                        <Link<AppRoute> classes={LINK_CSS_NEW_ACC} to={AppRoute::NewUserPractice}>
                            {Locale::current().add_new_practice()}
                        </Link<AppRoute>>
                    </div>
                </div>
            </BlankPage>
    }
}
