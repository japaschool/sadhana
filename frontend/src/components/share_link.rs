use crate::web_sys_ext::*;
use lazy_static::lazy_static;
use yew::prelude::*;
use yew_hooks::{use_bool_toggle, use_clipboard, use_mount, use_timeout};

use crate::i18n::Locale;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub relative_link: AttrValue,
    pub run_signal: Callback<Callback<MouseEvent>>,
}

lazy_static! {
    static ref URL_BASE: String = {
        web_sys::window()
            .expect("Can't get hold of the window object")
            .origin()
    };
}

pub fn can_share() -> bool {
    window()
        .iter()
        .map(|w| w.navigator().can_share().unwrap_or(false))
        .next()
        .unwrap_or(false)
}

pub fn set_signal_callback(
    run_signal: &UseStateHandle<Option<Callback<MouseEvent>>>,
) -> Callback<Callback<MouseEvent>> {
    let run_share_link = run_signal.clone();
    Callback::from(move |signal| run_share_link.set(Some(signal)))
}

pub fn emit_signal_callback(
    run_signal: &UseStateHandle<Option<Callback<MouseEvent>>>,
) -> Callback<MouseEvent> {
    let run = run_signal.clone();
    Callback::from(move |e| {
        if let Some(signal) = run.as_ref() {
            signal.emit(e)
        }
    })
}

#[function_component(ShareLink)]
pub fn share_link(props: &Props) -> Html {
    let clipboard = use_clipboard();
    let show_tooltip = use_bool_toggle(false);

    {
        let signal = props.run_signal.clone();
        let clipboard = clipboard.clone();
        let show_tooltip = show_tooltip.clone();
        let link = props.relative_link.clone();
        use_mount(move || {
            signal.emit(Callback::from(move |_| {
                let msg = format!("{}{}", URL_BASE.as_str(), link.as_str());
                if window()
                    .iter()
                    .flat_map(|w| {
                        w.navigator()
                            .can_share()
                            .unwrap_or(false)
                            .then(|| w.navigator().share_with_data(ShareData::new().url(&msg)))
                    })
                    .next()
                    .is_none()
                {
                    clipboard.write_text(msg);
                    show_tooltip.set(true);
                }
            }));
        })
    }

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
        use_effect_with(show_tooltip.clone(), move |show| {
            if **show {
                timeout.reset();
            }
            || ()
        });
    }

    html! {
        if *show_tooltip {
            <div class="fixed inset-0 flex items-center justify-center z-50">
                <span
                    class="bg-slate-600 bg-opacity-70 rounded-2xl border p-4 text-white text-2xl"
                >
                    { Locale::current().copied() }
                </span>
            </div>
        }
    }
}
