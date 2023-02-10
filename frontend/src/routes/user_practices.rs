use std::collections::HashSet;

use gloo_dialogs::{confirm, prompt};
use wasm_bindgen_futures::spawn_local;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount, use_set};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::UserPractice,
    services::{delete_user_practice, get_user_practices, update_user_practice},
};

use super::AppRoute;

#[function_component(UserPractices)]
pub fn user_practices() -> Html {
    let reload = use_state(|| true);
    let selected_practices = use_set::<String>(HashSet::from([]));
    let all_practices =
        use_async(async move { get_user_practices().await.map(|res| res.user_practices) });

    {
        // TODO: This is a hack that forces the state to reload from backend when we redirect
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
                log::debug!(
                    "Selected is set to {:?}; All {:?}",
                    selected.current(),
                    all.data
                );
                || ()
            },
            all_practices.clone(),
        );
    }

    let toggle_hidden = {
        let selected = selected_practices.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();

            let input: HtmlElement = e.target_unchecked_into();
            let practice = input.id();
            let is_active = !selected.current().contains(&practice);

            let up = UserPractice {
                practice: practice.clone(),
                is_active: is_active,
            };

            // TODO: possibly a better way to use Suspense with use_future once on yew 0.20
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
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            if confirm(Locale::current().delete_practice_warning().as_str()) {
                let input: HtmlElement = e.target_unchecked_into();
                let practice = input.id();

                log::debug!("Deleting user practice {:?}", practice);

                let all_practices = all_practices.clone();
                spawn_local(async move {
                    delete_user_practice(&practice)
                        .await
                        .and_then(|_| Ok(all_practices.run()))
                        .unwrap()
                });
            }
        })
    };

    let rename = {
        let all_practices = all_practices.clone();
        let selected = selected_practices.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();

            if let Some(new_name) =
                prompt(Locale::current().enter_new_practice_name().as_str(), None)
            {
                let input: HtmlElement = e.target_unchecked_into();
                let practice = input.id();
                let is_active = selected.current().contains(&practice);
                let all_practices = all_practices.clone();

                let up = UserPractice {
                    practice: new_name.clone(),
                    is_active,
                };

                spawn_local(async move {
                    update_user_practice(&practice, up)
                        .await
                        .and_then(|_| Ok(all_practices.run()))
                        .unwrap()
                });
            }
        })
    };

    let navigator = use_navigator().unwrap();
    let onclick_done = {
        let navigator = navigator.clone();
        Callback::from(move |_| {
            navigator.push(&AppRoute::Home);
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().select_practices() }>
            <ListErrors error={all_practices.error.clone()} />
            <div class={ BODY_DIV_CSS }>
                <form> {
                    all_practices.data.as_ref().unwrap_or(&vec![]).iter().map ( |p| {
                        html! {
                            <div class="relative flex">
                                <label class="flex w-full justify-between whitespace-nowrap mb-6">
                                    <span>{ p.practice.clone() }</span>
                                </label>
                                <label class="px-2" disabled=true >
                                    <i onclick={ toggle_hidden.clone() }
                                        id={ p.practice.clone() }
                                        class={ if selected_practices.current().contains(&p.practice) {"fa fa-eye"} else {"fa fa-eye-slash"}}
                                        />
                                </label>
                                <label class="px-2">
                                    <i onclick={ rename.clone() } id={ p.practice.clone() } class="fa fa-pen-to-square"/>
                                </label>
                                <label class="px-2">
                                    <i onclick={ delete.clone() } id={ p.practice.clone() } class="fa fa-trash"/>
                                </label>
                            </div>
                        }}).collect::<Html>()
                    }
                </form>
                <div class="relative flex justify-center">
                    <Link<AppRoute> classes={ LINK_CSS } to={AppRoute::NewUserPractice}>
                        { Locale::current().add_new_practice() }
                    </Link<AppRoute>>
                </div>
                <div class="relative">
                    <button onclick={ onclick_done.clone() } class={ SUBMIT_BTN_CSS }>{ Locale::current().done() }</button>
                </div>
            </div>
        </BlankPage>
    }
}
