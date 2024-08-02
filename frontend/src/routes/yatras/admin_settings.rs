use gloo_dialogs::{confirm, prompt};
use wasm_bindgen_futures::spawn_local;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount};
use yew_router::prelude::*;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        clipboard_copy_button::CopyButton,
        draggable_list::{DraggableList, Item},
        list_errors::ListErrors,
        summary_details::SummaryDetails,
    },
    css::*,
    i18n::Locale,
    services::{
        delete_yatra, delete_yatra_practice, delete_yatra_user, get_yatra, get_yatra_practices,
        get_yatra_users, rename_yatra, reorder_yatra_practices, toggle_is_admin_yatra_user,
        update_yatra_practice,
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
    let rename_yatra_name = use_state(String::default);
    let ordered_practices = use_list(vec![]);
    let nav = use_navigator().unwrap();
    let action_user_id = use_mut_ref(|| None::<String>);

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

    let members = {
        let yatra_id = props.yatra_id.to_owned();
        use_async(async move {
            get_yatra_users(yatra_id.as_str())
                .await
                .map(|res| res.users)
        })
    };

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

    let rename_yatra = {
        let yatra_id = props.yatra_id.clone();
        let new_name = rename_yatra_name.clone();
        use_async(async move { rename_yatra(yatra_id.as_str(), (*new_name).clone()).await })
    };

    let reorder_practices = {
        let yatra_id = props.yatra_id.clone();
        let op = ordered_practices.clone();
        use_async(async move {
            let op = op.current().to_owned();
            reorder_yatra_practices(yatra_id.as_str(), op).await
        })
    };

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
        let yatra = yatra.clone();
        use_effect_with(rename_yatra.clone(), move |_| {
            yatra.run();
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
                    .map(|_| all_practices.run())
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
                    .map(|_| all_practices.run())
                    .unwrap()
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
            if confirm(&Locale::current().delete_yatra_warning()) {
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

    let rename_yatra_onclick = {
        let yatra = yatra.clone();
        let rename_yatra = rename_yatra.clone();
        let new_name = rename_yatra_name.clone();
        Callback::from(move |_| {
            if let Some(new_value) = prompt(
                &Locale::current().name(),
                yatra.data.as_ref().map(|y| y.name.as_str()),
            )
            .filter(|s| !s.trim().is_empty())
            {
                new_name.set(new_value.trim().to_owned());
                rename_yatra.run();
            }
        })
    };

    let delete_member_onclick = {
        let user_id = action_user_id.clone();
        let delete_member = delete_member.clone();
        Callback::from(move |e: MouseEvent| {
            e.prevent_default();
            if confirm(&Locale::current().yatra_delete_member_confirmation()) {
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

    html! {
        <BlankPage
            header_label={ yatra.data.iter().map(|y| y.name.clone()).next().unwrap_or_default() }
            left_button={HeaderButtonProps::done(AppRoute::YatraSettings { id: props.yatra_id.to_string(), })}
            loading={ all_practices.loading || members.loading }
            >
            <ListErrors error={all_practices.error.clone()} />
            <ListErrors error={members.error.clone()} />
            <ListErrors error={toggle_is_admin.error.clone()} />
            <ListErrors error={delete_member.error.clone()} />
            <ListErrors error={reorder_practices.error.clone()} />
            <ListErrors error={rename_yatra.error.clone()} />
            <ListErrors error={delete_yatra.error.clone()} />
            <div class={BODY_DIV_CSS}>
                <form>
                    if !all_practices.loading {
                        <SummaryDetails label={Locale::current().yatra_practices()}>
                            <DraggableList
                                items={ all_practices.data
                                    .as_ref()
                                    .unwrap_or(&vec![])
                                    .iter()
                                    .map(|p| Item{ id: p.practice.clone(), name: p.practice.clone() })
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
                        </SummaryDetails>
                        <SummaryDetails label={Locale::current().yatra_members()}>
                            {for members.data.as_ref().unwrap_or(&vec![]).iter().enumerate().map( |(idx, user)| html! {
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
                                    {Locale::current().yatra_admin_label()}
                                </div>
                                <label>
                                    <i onclick={delete_member_onclick.clone()} id={user.user_id.clone()} class="cursor-pointer icon-bin"/>
                                </label>
                            </div>
                            })}
                        </SummaryDetails>
                    }
                </form>
                <div class="relative">
                    <button class={ BTN_CSS } onclick={new_yatra_practice_onclick}>
                        <i class="icon-plus"></i>
                        { Locale::current().add_new_practice() }
                    </button>
                    <CopyButton
                        class={BTN_CSS}
                        share_button_label={Locale::current().share_yatra_join_link()}
                        copy_button_label={Locale::current().copy_yatra_join_link()}
                        relative_link={ format!("/yatra/{}/join", props.yatra_id.as_str()) }
                        />
                    <button class={ BTN_CSS } onclick={rename_yatra_onclick}>
                        <i class="icon-edit"></i>
                        { Locale::current().rename_yatra() }
                    </button>
                    <button class={ SUBMIT_BTN_CSS } onclick={ delete_yatra_onclick }>
                        <i class="icon-bin"></i>
                        { format!(" {}", Locale::current().delete_yatra()) }
                    </button>
                </div>
            </div>
        </BlankPage>
    }
}
