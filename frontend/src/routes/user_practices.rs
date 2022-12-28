use std::collections::HashSet;

use wasm_bindgen_futures::spawn_local;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_mount, use_set};
use yew_router::prelude::*;

use crate::{
    model::UserPractice,
    services::{get_user_practices, update_user_practice_activity},
};

use super::AppRoute;

#[function_component(UserPractices)]
pub fn user_practices() -> Html {
    // let all_practices = use_list(vec!["Rounds, Total", "Rounds before 7am", "Reading Books"]);
    let selected_practices = use_set::<String>(HashSet::from([]));
    let all_practices =
        use_async(async move { get_user_practices().await.map(|res| res.user_practices) });

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

    let oninput = {
        let selected = selected_practices.clone();
        Callback::from(move |e: InputEvent| {
            e.prevent_default();

            let input: HtmlInputElement = e.target_unchecked_into();
            let nm = input.name();
            let up = UserPractice {
                practice: nm.clone(),
                is_active: input.checked(),
            };

            // TODO: possibly a better way to use Suspense with use_future once on yew 0.20
            spawn_local(async move { update_user_practice_activity(&up).await.unwrap() });

            if input.checked() {
                selected.insert(nm);
            } else {
                selected.remove(&nm);
            }
        })
    };

    html! {
        <div>
            <h1>{"Select Practices"}</h1>
            <form> {
                all_practices.data.as_ref().unwrap_or(&vec![]).iter().map ( |p| {
                    html! {
                        <div>
                            <input
                                oninput={ oninput.clone() }
                                name={ p.practice.clone() }
                                type="checkbox"
                                checked={ selected_practices.current().contains(&p.practice) }
                                />
                            <label>{ p.practice.clone() }</label>
                        </div>
                    }}).collect::<Html>()
                }
            </form>
            <p>
                <Link<AppRoute> to={AppRoute::Home}>
                    { "Done" }
                </Link<AppRoute>>
            </p>
        </div>
    }
}
