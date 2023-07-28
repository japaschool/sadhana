use std::collections::HashSet;

use common::error::AppError;
use gloo_dialogs::confirm;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_list, use_mount, use_set};
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, YatraUserPractice},
    routes::AppRoute,
    services::{
        get_user_practices, get_yatra, get_yatra_user_practices, is_yatra_admin, leave_yatra,
        update_yatra_user_practices,
    },
};

#[derive(Properties, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
}

#[function_component(YatraSettings)]
pub fn yatra_settings(props: &Props) -> Html {
    let yatra = {
        let yatra_id = props.yatra_id.clone();
        use_async(async move { get_yatra(&yatra_id).await.map(|resp| resp.yatra) })
    };
    let yatra_user_practices = {
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            get_yatra_user_practices(&yatra_id.as_str())
                .await
                .map(|res| res.practices)
        })
    };

    let user_practices = {
        use_async(async move {
            get_user_practices().await.map(|res| {
                res.user_practices
                    .into_iter()
                    .filter(|p| p.is_active)
                    .collect::<Vec<_>>()
            })
        })
    };
    let nav = use_navigator().unwrap();

    let leave = {
        let yatra_id = props.yatra_id.clone();
        let nav = nav.clone();
        use_async(async move {
            leave_yatra(&yatra_id)
                .await
                .map(|_| nav.push(&AppRoute::Yatras))
        })
    };

    let mapped_practices = use_list(vec![]);
    let mapped_user_practices = use_set(HashSet::<String>::default());

    let is_admin = {
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            is_yatra_admin(yatra_id.as_str())
                .await
                .map(|resp| resp.is_admin)
        })
    };

    let save = {
        let mapped_practices = mapped_practices.clone();
        let yatra_id = props.yatra_id.clone();
        let nav = nav.clone();
        use_async(async move {
            update_yatra_user_practices(yatra_id.as_str(), &*mapped_practices.current())
                .await
                .map(|_| nav.push(&AppRoute::Yatras))
        })
    };

    {
        let is_admin = is_admin.clone();
        let yatra = yatra.clone();
        let yatra_practices = yatra_user_practices.clone();
        let user_practices = user_practices.clone();
        use_mount(move || {
            is_admin.run();
            yatra_practices.run();
            user_practices.run();
            yatra.run();
        });
    }

    {
        let mapped_practices = mapped_practices.clone();
        let mapped_user_practices = mapped_user_practices.clone();
        use_effect_with_deps(
            move |yp| {
                yp.data
                    .iter()
                    .for_each(|inner| mapped_practices.set(inner.clone()));
                mapped_user_practices.set(
                    yp.data
                        .iter()
                        .flat_map(|inner| inner.iter())
                        .filter_map(|yp| yp.user_practice.clone())
                        .collect::<HashSet<_>>(),
                );

                || ()
            },
            yatra_user_practices.clone(),
        )
    }

    let leave_onclick = {
        let leave = leave.clone();
        Callback::from(move |_: MouseEvent| {
            if confirm(&Locale::current().leave_yatra_practice_warning()) {
                leave.run();
            }
        })
    };

    let practice_onchange = {
        let mapped = mapped_practices.clone();
        let mapped_user_practices = mapped_user_practices.clone();
        Callback::from(move |e: Event| {
            e.prevent_default();
            let input: HtmlInputElement = e.target_unchecked_into();

            let yatra_practice = input.id();
            let user_practice = input.value();

            if !user_practice.is_empty() {
                log::debug!("Inserting into mapped_user_practices {}", user_practice);
                mapped_user_practices.insert(user_practice.clone());
            }

            let (idx, value) = {
                let mapped_current = mapped.current();
                let (idx, value) = mapped_current
                    .iter()
                    .enumerate()
                    .find(|(_, v)| v.yatra_practice.practice == yatra_practice)
                    .unwrap();

                value.user_practice.iter().for_each(|up| {
                    log::debug!("Removing from mapped_user_practices {}", up);
                    mapped_user_practices.remove(up);
                });

                (
                    idx,
                    YatraUserPractice {
                        yatra_practice: value.yatra_practice.clone(),
                        user_practice: Some(user_practice).filter(|v| !v.is_empty()),
                    },
                )
            };

            log::debug!("Updating mapped_practices with {:?}", value);
            mapped.update(idx, value);
        })
    };

    let onsubmit = {
        let save = save.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            save.run();
        })
    };

    fn practice_icon(data_type: &PracticeDataType) -> String {
        (match data_type {
            PracticeDataType::Int => "icon-rounds",
            PracticeDataType::Bool => "icon-tick",
            PracticeDataType::Time => "icon-clock",
            PracticeDataType::Text => "icon-doc",
            PracticeDataType::Duration => "icon-clock",
        })
        .into()
    }

    let practices = {
        mapped_practices
            .current()
            .iter()
            .map(|yp| {
                html! {
                    <div class="relative">
                        <select
                            class={ INPUT_CSS }
                            id={ yp.yatra_practice.practice.clone() }
                            onchange={ practice_onchange.clone() }
                            >
                            <option class="text-black" selected={ yp.user_practice.is_none() } >{ "" }</option>
                            {
                                user_practices
                                    .data
                                    .iter()
                                    .flat_map(|inner| inner.iter())
                                    .filter(|up| {
                                        up.data_type == yp.yatra_practice.data_type
                                            && (!mapped_user_practices.current().contains(&up.practice)
                                                || yp
                                                    .user_practice
                                                    .iter()
                                                    .find(|p| **p == up.practice)
                                                    .is_some())
                                    })
                                    .map(|up| {
                                        html! {
                                            <option
                                                class={ "text-black" }
                                                selected={ yp.user_practice.iter().find(|p| **p == up.practice).is_some() }
                                                value={ up.practice.clone() } >
                                                { up.practice.clone() }
                                            </option>
                                        }
                                    })
                                    .collect::<Html>()
                            }
                        </select>
                        <label for={ { yp.yatra_practice.practice.clone() } } class={ INPUT_LABEL_CSS }>
                            <i class={ practice_icon(&yp.yatra_practice.data_type) }></i>
                            { format!(" {}: ", yp.yatra_practice.practice) }
                        </label>
                    </div>
                }
            })
            .collect::<Html>()
    };

    let leave_error_formatter = {
        Callback::from(move |err| match err {
            AppError::UnprocessableEntity(err)
                if err
                    .iter()
                    .find(|s| s.ends_with("Can't delete last yatra admin"))
                    .is_some() =>
            {
                Some(Locale::current().last_yatra_admin_cannot_leave())
            }
            _ => None,
        })
    };

    html! {
        <BlankPage
            header_label={ yatra.data.iter().map(|y| y.name.clone()).next().unwrap_or_default() }
            loading={ leave.loading || yatra.loading || is_admin.loading || yatra_user_practices.loading || user_practices.loading || save.loading }
            prev_link={ (Locale::current().cancel(), AppRoute::Yatras) }
            >
            <ListErrors error={ yatra_user_practices.error.clone() } />
            <ListErrors error={ user_practices.error.clone() } />
            <ListErrors error={ is_admin.error.clone() } />
            <ListErrors error={ save.error.clone() } />
            <ListErrors error={ leave.error.clone() } error_formatter = {leave_error_formatter}/>
            <ListErrors error={ yatra.error.clone() } />
            <form {onsubmit}>
                <div class={ BODY_DIV_CSS }>
                    <div class={ LINKS_CSS }>
                        <a class={ LINK_CSS } onclick={ leave_onclick }>{ Locale::current().leave_yatra() }</a>
                        { if is_admin.data.unwrap_or(false) {
                            html! {
                                <Link<AppRoute> classes={ LINK_CSS }
                                    to={AppRoute::YatraAdminSettings{ id: props.yatra_id.to_string() }}>
                                    { Locale::current().modify_yatra() }
                                </Link<AppRoute>>
                            }
                        } else {
                            html! {}
                        }}
                    </div>
                    <div class="relative">
                        <label class="text-gray-600">{ Locale::current().yatra_mapping_info() }</label>
                    </div>
                    { practices }
                    <div class="relative">
                        <button class={ SUBMIT_BTN_CSS }>
                            <i class="icon-tick"></i>{ format!(" {}", Locale::current().save()) }
                        </button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
