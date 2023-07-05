use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::*,
    services::{create_user_share, delete_user_share, get_user_shares},
};
use gloo_dialogs::{confirm, prompt};
use lazy_static::lazy_static;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::prelude::*;

lazy_static! {
    static ref SHARE_URL_BASE: String = {
        format!(
            "{}/shared",
            web_sys::window().expect("BASE URL is not set").origin()
        )
    };
}

#[function_component(UserShares)]
pub fn user_shares() -> Html {
    let all_shares = use_async(async move { get_user_shares().await.map(|v| v.shares) });

    {
        let all_shares = all_shares.clone();
        use_mount(move || all_shares.run());
    }

    let create_sharing_link_description: UseStateHandle<Option<String>> = use_state(|| None);
    let create_sharing_link = {
        let description = create_sharing_link_description.clone();
        use_async(async move {
            if let Some(desc) = description.as_ref() {
                description.set(None);
                create_user_share(desc).await
            } else {
                Ok(())
            }
        })
    };

    let delete_sharing_link_id: UseStateHandle<Option<String>> = use_state(|| None);
    let delete_sharing_link = {
        let id = delete_sharing_link_id.clone();
        use_async(async move {
            if let Some(id) = id.as_ref() {
                delete_user_share(id).await
            } else {
                Ok(())
            }
        })
    };

    {
        let all_shares = all_shares.clone();
        use_effect_with_deps(
            move |_| {
                all_shares.run();
                || ()
            },
            (create_sharing_link.clone(), delete_sharing_link.clone()),
        );
    }

    let clipboard = use_clipboard();

    let delete = {
        let id = delete_sharing_link_id.clone();
        let delete_sharing_link = delete_sharing_link.clone();
        Callback::from(move |e: MouseEvent| {
            if confirm(Locale::current().delete_warning().as_str()) {
                let input: HtmlElement = e.target_unchecked_into();
                id.set(Some(input.id()));
                delete_sharing_link.run();
            }
        })
    };

    let show_tooltip = use_bool_toggle(false);

    let tooltip_timeout = {
        let show_tooltip = show_tooltip.clone();
        use_timeout(
            move || {
                show_tooltip.set(false);
            },
            2000,
        )
    };

    {
        let timeout = tooltip_timeout.clone();
        use_effect_with_deps(
            move |show| {
                if **show {
                    timeout.reset();
                }
                || ()
            },
            show_tooltip.clone(),
        );
    }

    let copy = {
        let clipboard = clipboard.clone();
        let show_tooltip = show_tooltip.clone();
        Callback::from(move |e: MouseEvent| {
            let input: HtmlElement = e.target_unchecked_into();
            let msg = format!("{}/{}", SHARE_URL_BASE.as_str(), input.id());
            clipboard.write_text(msg);
            show_tooltip.set(true);
        })
    };

    let create = {
        let create_sharing_link = create_sharing_link.clone();
        let description = create_sharing_link_description.clone();
        Callback::from(move |_| {
            if let Some(desc) = prompt(Locale::current().short_description().as_str(), None)
                .filter(|s| !s.trim().is_empty())
            {
                description.set(Some(desc));
                create_sharing_link.run();
            }
        })
    };

    html! {
        <BlankPage
            show_footer=true
            header_label={ Locale::current().sharing_links() }
            loading={ all_shares.data.is_none() || delete_sharing_link.loading || create_sharing_link.loading }
            >
            <ListErrors error={all_shares.error.clone()} />
            <ListErrors error={delete_sharing_link.error.clone()} />
            <ListErrors error={create_sharing_link.error.clone()} />
            <div
                class={ format!("{} absolute left-0 top-0 flex h-full w-full items-center justify-center z-50", if *show_tooltip {"inline"} else {"hidden"}) }>
                <span class="bg-slate-600 bg-opacity-50 rounded-2xl border p-4 text-white text-2xl">{ Locale::current().copied() }</span>
            </div>
            <div class={ BODY_DIV_CSS }>
                <form>{
                all_shares
                    .data
                    .as_ref()
                    .unwrap_or(&vec![])
                    .iter()
                    .map(|share| html! {
                        <div
                            class="flex w-full"
                            id={ share.id.clone() }
                            >
                            // FIXME: fix horizontally into the screen as they could get long
                            <label class="flex w-full justify-between whitespace-nowrap mb-6">
                                <span>{ share.description.clone() }</span>
                            </label>
                            <label class="px-2 py-1">
                                <i onclick={ copy.clone() } id={ share.id.clone() } class="fa fa-copy"/>
                            </label>
                            <label class="px-2 py-1">
                                <i onclick={ delete.clone() } id={ share.id.clone() } class="fa fa-trash"/>
                            </label>
                        </div>
                    })
                    .collect::<Html>()
                } </form>
            </div>
            <div>
                <button onclick={ create.clone() } class={ SUBMIT_BTN_CSS }>{ Locale::current().add_new() }</button>
            </div>
        </BlankPage>
    }
}
