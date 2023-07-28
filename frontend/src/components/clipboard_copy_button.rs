use lazy_static::lazy_static;
use yew::prelude::*;
use yew_hooks::{use_bool_toggle, use_clipboard, use_timeout};

use crate::{css::*, i18n::Locale};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub button_label: AttrValue,
    pub relative_link: AttrValue,
}

lazy_static! {
    static ref URL_BASE: String = {
        web_sys::window()
            .expect("Can't get hold of the window object")
            .origin()
    };
}

#[function_component(CopyButton)]
pub fn copy_button(props: &Props) -> Html {
    let clipboard = use_clipboard();
    let show_tooltip = use_bool_toggle(false);

    let onclick = {
        let clipboard = clipboard.clone();
        let show_tooltip = show_tooltip.clone();
        let link = props.relative_link.clone();
        Callback::from(move |_| {
            let msg = format!("{}{}", URL_BASE.as_str(), link.as_str());
            clipboard.write_text(msg);
            show_tooltip.set(true);
        })
    };

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

    html! {
        <>
            <div
                class={ format!("{} absolute left-0 top-0 flex h-full w-full justify-center z-50", if *show_tooltip {"inline"} else {"hidden"}) }>
                <span class="bg-slate-600 bg-opacity-50 rounded-2xl my-auto border p-4 text-white text-2xl">{ Locale::current().copied() }</span>
            </div>
            <div class="relative">
                <button { onclick } class={ BTN_CSS }>
                <i class="icon-doc-dup"></i>{ format!(" {}", props.button_label) }</button>
            </div>
        </>
    }
}
