use std::collections::HashSet;

use gloo_dialogs::{confirm, prompt};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::spawn_local;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount, use_set};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
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

    let navigator = use_navigator().unwrap();

    {
        // Refresh active practices when all_practices change
        let selected = selected_practices.clone();
        let ordered = ordered_practices.clone();
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
                ordered.set(
                    all.data
                        .as_ref()
                        .unwrap_or(&vec![])
                        .iter()
                        .map(|p| p.practice.clone())
                        .collect::<Vec<_>>(),
                );
                || ()
            },
            all_practices.clone(),
        );
    }

    let reorder_practices_and_leave = {
        let ordered_practices = ordered_practices.clone();
        let navigator = navigator.clone();
        use_async(async move {
            reorder_user_practices(ordered_practices.current().to_owned())
                .await
                .map(|_| navigator.push(&AppRoute::Home))
        })
    };

    let toggle_hidden = {
        let selected = selected_practices.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();

            let input: HtmlElement = e.target_unchecked_into();
            let practice = input.id();
            let is_active = !selected.current().contains(&practice);

            let up = UserPractice {
                practice: practice.clone(),
                data_type: PracticeDataType::Bool, //Adding to satisfy constructor but is actually never used
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

            let input: HtmlElement = e.target_unchecked_into();
            let practice = input.id();

            if let Some(new_name) = prompt(
                Locale::current().enter_new_practice_name().as_str(),
                Some(&practice),
            ) {
                let is_active = selected.current().contains(&practice);
                let all_practices = all_practices.clone();

                let up = UserPractice {
                    practice: new_name.trim().to_owned(),
                    data_type: PracticeDataType::Bool, //Adding to satisfy constructor but is actually never used
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

    let onclick_done = {
        let reorder_practices_and_leave = reorder_practices_and_leave.clone();
        Callback::from(move |_| {
            reorder_practices_and_leave.run();
        })
    };

    // Drag and drop inspired by this article: https://stackoverflow.com/questions/54237737/html5-dragndrop-not-working-on-ios-12-1-2-safari-and-chrome

    fn get_div(target: HtmlElement) -> HtmlElement {
        if target.node_name() != "DIV" {
            return get_div(target.parent_element().unwrap().unchecked_into());
        }
        target
    }

    let dragging = use_mut_ref(|| None);

    let ondragstart = {
        let dragging = dragging.clone();
        Callback::from(move |e: DragEvent| {
            let target: HtmlElement = get_div(e.target_unchecked_into());
            *dragging.borrow_mut() = Some(target.clone());
            e.data_transfer()
                .unwrap()
                .set_drag_image(&target, target.client_width() - 20, 0);
            e.data_transfer()
                .unwrap()
                .set_data("text/plain", "hello")
                .unwrap();
        })
    };

    let ondragover = {
        Callback::from(move |e: DragEvent| {
            e.prevent_default();
            let target = get_div(e.target_unchecked_into());
            let offset = target.client_top() + target.client_height() / 2;
            if e.client_y() - offset > 0 {
                target
                    .style()
                    .set_property("border-bottom", "solid 4px grey")
                    .unwrap();
                target.style().set_property("border-top", "").unwrap();
            } else {
                target
                    .style()
                    .set_property("border-top", "solid 4px grey")
                    .unwrap();
                target.style().set_property("border-bottom", "").unwrap();
            }
        })
    };

    let ondragleave = {
        Callback::from(move |e: DragEvent| {
            let target: HtmlElement = get_div(e.target_unchecked_into());
            target.style().set_property("border-top", "").unwrap();
            target.style().set_property("border-bottom", "").unwrap();
        })
    };

    let ondrop = {
        let dragging = dragging.clone();
        let ordered = ordered_practices.clone();
        Callback::from(move |e: DragEvent| {
            e.prevent_default();
            let target: HtmlElement = get_div(e.target_unchecked_into());
            let dragging = dragging.borrow_mut().take().unwrap();
            if !target
                .style()
                .get_property_value("border-bottom")
                .unwrap()
                .is_empty()
            {
                target.style().set_property("border-bottom", "").unwrap();
            } else {
                target.style().set_property("border-top", "").unwrap();
            }
            let dragging_idx: usize = dragging.id().parse().unwrap();
            let mut target_idx: usize = target.id().parse().unwrap();
            // If moving up need to adjust the new index by 1.
            // This is cause we draw only the bottom line.
            if target_idx < dragging_idx {
                target_idx += 1;
            }
            let p = ordered.remove(dragging_idx);
            ordered.insert(target_idx, p);
        })
    };

    html! {
        <BlankPage header_label={ Locale::current().select_practices() }>
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={reorder_practices_and_leave.error.clone()} />
            <div class={ BODY_DIV_CSS }>
                <form> {
                    ordered_practices.current().iter().enumerate().map ( |(idx, p)| {
                        html! {
                            <div
                                ondragstart={ ondragstart.clone() }
                                ondrop={ ondrop.clone() }
                                ondragover={ ondragover.clone() }
                                ondragleave={ ondragleave.clone() }
                                class="flex w-full"
                                id={ idx.to_string() }
                                >
                                <label class="flex w-full justify-between whitespace-nowrap mb-6">
                                    <span>{ p.clone() }</span>
                                </label>
                                <label class="px-2 py-1" >
                                    <i onclick={ toggle_hidden.clone() }
                                        id={ p.clone() }
                                        class={ if selected_practices.current().contains(p) {"fa fa-eye"} else {"fa fa-eye-slash"}}
                                        />
                                </label>
                                <label class="px-2 py-1">
                                    <i onclick={ rename.clone() } id={ p.clone() } class="fa fa-pen-to-square"/>
                                </label>
                                <label class="px-2 py-1">
                                    <i onclick={ delete.clone() } id={ p.clone() } class="fa fa-trash"/>
                                </label>
                                <label draggable="true" class="px-2 py-1 touch-none"><i class="fa-solid fa-bars"></i></label>
                            </div>
                        }}).collect::<Html>()
                    }
                </form>
                <div class="flex justify-center">
                    <Link<AppRoute> classes={ LINK_CSS } to={AppRoute::NewUserPractice}>
                        { Locale::current().add_new_practice() }
                    </Link<AppRoute>>
                </div>
                <div>
                    <button onclick={ onclick_done.clone() } class={ SUBMIT_BTN_CSS }>{ Locale::current().done() }</button>
                </div>
            </div>
        </BlankPage>
    }
}
