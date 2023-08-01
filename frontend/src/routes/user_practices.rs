use std::collections::HashSet;

use wasm_bindgen_futures::spawn_local;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount, use_set};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, draggable_list::DraggableList, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, UserPractice},
    services::{
        delete_user_practice, get_user_practices, reorder_user_practices, update_user_practice,
    },
};

use super::AppRoute;

#[function_component(UserPractices)]
pub fn user_practices() -> Html {
    let reload = use_state(|| true);
    let selected_practices = use_set::<String>(HashSet::from([]));
    let ordered_practices = use_list(vec![]);
    let all_practices =
        use_async(async move { get_user_practices().await.map(|res| res.user_practices) });

    let reorder_practices = {
        let op = ordered_practices.clone();
        use_async(async move { reorder_user_practices(op.current().to_owned()).await })
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
        use_mount(move || {
            log::debug!("Loading All Practices");
            all_practices.run();
        });
    }

    {
        // Refresh active practices when all_practices change
        let selected = selected_practices.clone();
        use_effect_with_deps(
            move |all| {
                log::debug!("All Practices loaded. Initialising active practices");

                selected.set(
                    all.data
                        .as_ref()
                        .unwrap_or(&vec![])
                        .iter()
                        .filter_map(|p| {
                            if p.is_active {
                                Some(p.practice.clone())
                            } else {
                                None
                            }
                        })
                        .collect::<HashSet<String>>(),
                );
                || ()
            },
            all_practices.clone(),
        );
    }

    let is_hidden = {
        let selected = selected_practices.clone();
        Callback::from(move |practice: String| !selected.current().contains(&practice))
    };

    let toggle_hidden = {
        let selected = selected_practices.clone();
        Callback::from(move |practice: String| {
            let is_active = !selected.current().contains(&practice);

            let up = UserPractice {
                practice: practice.clone(),
                data_type: PracticeDataType::Bool, //Adding to satisfy constructor but is actually never used
                is_active: is_active,
            };

            let p = practice.clone();
            spawn_local(async move { update_user_practice(&p, up).await.unwrap() });

            if is_active {
                selected.insert(practice);
            } else {
                selected.remove(&practice);
            }
        })
    };

    let delete = {
        let all_practices = all_practices.clone();
        Callback::from(move |practice: String| {
            log::debug!("Deleting user practice {:?}", practice);

            let all_practices = all_practices.clone();
            spawn_local(async move {
                delete_user_practice(&practice)
                    .await
                    .and_then(|_| Ok(all_practices.run()))
                    .unwrap()
            });
        })
    };

    let rename = {
        let all_practices = all_practices.clone();
        let selected = selected_practices.clone();
        Callback::from(move |(from, to): (String, String)| {
            let is_active = selected.current().contains(&from);
            let all_practices = all_practices.clone();

            let up = UserPractice {
                practice: to.trim().to_owned(),
                data_type: PracticeDataType::Bool, //Adding to satisfy constructor but is actually never used
                is_active,
            };

            spawn_local(async move {
                update_user_practice(&from, up)
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

    html! {
        <BlankPage
            header_label={ Locale::current().select_practices() }
            prev_link={ (Locale::current().done(), AppRoute::Home) }
            show_footer=true
            loading={ all_practices.loading }>
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={reorder_practices.error.clone()} />
            <div class={ format!("space-y-10 {}", BODY_DIV_CSS) }>
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
                            toggle_hidden={ toggle_hidden.clone() }
                            is_hidden={ is_hidden.clone() }
                            rename={ rename.clone() }
                            rename_popup_label={ Locale::current().enter_new_practice_name() }
                            delete={ delete.clone() }
                            delete_popup_label={ Locale::current().delete_practice_warning() }
                            reorder = { reorder.clone() }
                            />
                    }}}
                </form>
                <div class="flex justify-center">
                    <Link<AppRoute> classes={ LINK_CSS_NEW_ACC } to={AppRoute::NewUserPractice}>
                        { Locale::current().add_new_practice() }
                    </Link<AppRoute>>
                </div>
            </div>
        </BlankPage>
    }
}
