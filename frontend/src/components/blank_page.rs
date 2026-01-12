use gloo::utils::window;
use gloo_utils::format::JsValueSerdeExt;
use serde::Serialize;
use tw_merge::*;
use wasm_bindgen::JsValue;
use yew::{html::onclick::Event, prelude::*};
use yew_hooks::{UseToggleHandle, use_bool_toggle, use_timeout};
use yew_router::prelude::*;

use super::{calendar::Calendar, month_calendar::MonthCalendar};
use crate::{
    css::*,
    hooks::{NetworkStatus, use_visibility},
    i18n::Locale,
    routes::AppRoute,
    services::requests,
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub header_label: Option<String>,
    #[prop_or_default]
    pub header_sub_label: Option<String>,
    #[prop_or_default]
    pub left_button: Option<HeaderButtonProps>,
    #[prop_or_default]
    pub right_button: Option<HeaderButtonProps>,
    #[prop_or_default]
    pub right_button2: Option<HeaderButtonProps>,
    #[prop_or(false)]
    pub loading: bool,
    #[prop_or(false)]
    pub show_footer: bool,
    #[prop_or_default]
    pub selected_page: Option<AppRoute>,
    #[prop_or_default]
    pub calendar: Option<CalendarProps>,
    pub children: Children,
}

#[derive(Clone, PartialEq)]
pub struct CalendarProps {
    pub highlight_incomplete_dates: bool,
    pub selected_date_incomplete: Option<bool>,
}

impl CalendarProps {
    pub fn new(selected_date_incomplete: Option<bool>) -> Self {
        Self {
            highlight_incomplete_dates: true,
            selected_date_incomplete,
        }
    }

    pub fn no_override_selected_date() -> Self {
        Self {
            highlight_incomplete_dates: true,
            selected_date_incomplete: None,
        }
    }
}

#[derive(Clone, PartialEq)]
pub enum ButtonType {
    Button,
    Submit,
    Reset,
}
impl ButtonType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ButtonType::Button => "button",
            ButtonType::Submit => "submit",
            ButtonType::Reset => "reset",
        }
    }
}

#[derive(Clone, PartialEq)]
pub enum Action {
    Cb(Callback<Event>),
    Redirect(AppRoute),
    NavBack,
    CtxMenu(Vec<CtxMenuEntry>),
}

#[derive(Clone, PartialEq)]
pub struct CtxMenuEntry {
    label: String,
    icon_css: Option<String>,
    action: Action,
}
impl CtxMenuEntry {
    pub fn action<S: Into<String>>(onclick: Callback<Event>, icon_css: S, label: S) -> Self {
        Self {
            label: label.into(),
            icon_css: Some(icon_css.into()),
            action: Action::Cb(onclick),
        }
    }

    pub fn link<S: Into<String>>(route: AppRoute, icon_css: S, label: S) -> Self {
        Self {
            label: label.into(),
            icon_css: Some(icon_css.into()),
            action: Action::Redirect(route),
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct HeaderButtonProps {
    label: Option<String>,
    icon_css: Option<String>,
    action: Action,
    btn_type: ButtonType,
}

impl HeaderButtonProps {
    pub fn new_cb<S: Into<String>>(
        label: S,
        onclick: Callback<Event>,
        icon_css: Option<String>,
        btn_type: ButtonType,
    ) -> Self {
        Self {
            label: Some(label.into()).filter(|s| !s.is_empty()),
            icon_css,
            action: Action::Cb(onclick),
            btn_type,
        }
    }

    pub fn new_redirect<S: Into<String>>(
        label: S,
        route: AppRoute,
        icon_css: Option<String>,
        btn_type: ButtonType,
    ) -> Self {
        Self {
            label: Some(label.into()),
            icon_css,
            action: Action::Redirect(route),
            btn_type,
        }
    }

    pub fn new_icon_cb<S: Into<String>>(
        onclick: Callback<Event>,
        icon_css: S,
        btn_type: ButtonType,
    ) -> Self {
        Self {
            label: None,
            icon_css: Some(icon_css.into()),
            action: Action::Cb(onclick),
            btn_type,
        }
    }

    pub fn new_icon_redirect<S: Into<String>>(route: AppRoute, icon_css: S) -> Self {
        Self {
            label: None,
            icon_css: Some(icon_css.into()),
            action: Action::Redirect(route),
            btn_type: ButtonType::Button,
        }
    }

    pub fn edit(onclick: Callback<Event>) -> Self {
        Self::new_cb("", onclick, Some("icon-edit".into()), ButtonType::Button)
    }

    pub fn done(redirect_to: AppRoute) -> Self {
        Self::new_redirect(
            Locale::current().done(),
            redirect_to,
            None,
            ButtonType::Button,
        )
    }

    pub fn submit<S: Into<String>>(label: S) -> Self {
        Self::new_cb(label, Callback::default(), None, ButtonType::Submit)
    }

    pub fn reset<S: Into<String>>(label: S) -> Self {
        Self::new_cb(label.into(), Callback::default(), None, ButtonType::Reset)
    }

    pub fn blank() -> Self {
        Self {
            label: None,
            action: Action::Cb(Callback::default()),
            icon_css: None,
            btn_type: ButtonType::Button,
        }
    }

    pub fn back() -> Self {
        HeaderButtonProps {
            label: None,
            icon_css: Some("icon-chevron-left".into()),
            action: Action::NavBack,
            btn_type: ButtonType::Button,
        }
    }

    pub fn back_to(to: AppRoute) -> Self {
        Self::new_icon_redirect(to, "icon-chevron-left")
    }

    pub fn month_calendar(onclick: Callback<Event>) -> Self {
        Self::new_icon_cb(onclick, "icon-calendar", ButtonType::Button)
    }

    pub fn ctx_menu<S: Into<String>>(icon_css: S, entries: Vec<CtxMenuEntry>) -> Self {
        Self {
            label: None,
            icon_css: Some(icon_css.into()),
            action: Action::CtxMenu(entries),
            btn_type: ButtonType::Button,
        }
    }
}

fn header_button(
    buttons: &[&HeaderButtonProps],
    nav: Navigator,
    show_menu: UseToggleHandle<bool>,
) -> Html {
    let css = tw_merge!(
        HEADER_BUTTON_CSS,
        if buttons.iter().any(|p| p.label.is_some()) {
            "text-base font-bold"
        } else {
            "text-xl"
        }
    );

    let hide_menu = {
        let menu_toggle = show_menu.clone();
        Callback::from(move |_| menu_toggle.set(false))
    };

    let onclick = |action: &Action| {
        let nav = nav.clone();
        let show_menu = show_menu.clone();

        match action {
            Action::Cb(cb) => cb.clone(),
            Action::Redirect(to) => {
                let route = to.clone();
                Callback::from(move |_| nav.push(&route))
            }
            Action::NavBack => Callback::from(move |_| nav.back()),
            Action::CtxMenu(_) => Callback::from(move |_| show_menu.toggle()),
        }
    };

    let onclick_with_hide = |action: &Action| {
        let hide_menu = hide_menu.clone();
        let onclick = onclick(action);
        Callback::from(move |e: MouseEvent| {
            hide_menu.emit(e.clone());
            onclick.emit(e)
        })
    };

    let ctx_menu_iter_html = |item: &CtxMenuEntry| match &item.action {
        Action::Cb(_) | Action::Redirect(_) => html! {
            <li onclick={onclick_with_hide(&item.action)}>
                <div
                    class="flex px-2 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                    <label>
                        <i
                            class={tw_merge!(item.icon_css.to_owned().unwrap_or_default(), "flex-shrink-0 w-5")}
                        />
                        { &item.label }
                    </label>
                </div>
            </li>
        },
        _ => panic!("Unsupported feature - nested context menus"),
    };

    let ctx_menu_items = |action: &Action| match action {
        Action::CtxMenu(items) => items.iter().map(ctx_menu_iter_html).collect::<Html>(),
        _ => html! {},
    };

    html! {
        <span>
            { for buttons.iter().map(|props| {
            html! {
                <>
                <button type={props.btn_type.as_str()} class={css.clone()} onclick={onclick(&props.action)}>
                    <i class={props.icon_css.to_owned().unwrap_or_default()}></i>
                    if let Some(l) = &props.label {
                        {l}
                    }
                </button>
                if *show_menu && matches!(&props.action, Action::CtxMenu(_)) {
                    <div // Fill on the screen with a div that hides menu on click
                        class="fixed top-0 bottom-0 left-0 right-0 w-full h-full z-10"
                        onclick={
                            let show_menu = show_menu.clone();
                            Callback::from(move |_| show_menu.toggle())
                        }
                    />
                    <ul
                        class={tw_merge!("origin-top-right absolute right-0 w-65 text-gray-800 dark:text-white focus:outline-none z-20 mt-2 py-1", POPUP_BG_CSS)}
                    >
                        {ctx_menu_items(&props.action)}
                    </ul>
                }
                </>
            }
        }) }
        </span>
    }
}

pub const HEADER_BUTTON_CSS: &str = "no-underline text-amber-400";

#[derive(Debug, Serialize)]
struct CheckUpdateMsg {
    #[serde(rename = "type")]
    msg_type: String,
    token: String,
}

#[function_component(BlankPage)]
pub fn blank_page(props: &Props) -> Html {
    let nav = use_navigator().unwrap();
    let loading = use_bool_toggle(false);
    let show_month_cal = use_bool_toggle(false);
    let show_ctx_menu = use_bool_toggle(false);
    let network_status = use_context::<NetworkStatus>().expect("NetworkStatus context not found");
    let visibility = use_visibility();

    {
        // On wake of the app check for the app update
        use_effect_with(visibility.clone(), move |v| {
            if v.visible {
                if let Some(token) = requests::get_token() {
                    if let Some(controller) = window().navigator().service_worker().controller() {
                        let msg = CheckUpdateMsg {
                            msg_type: "CHECK_UPDATE".into(),
                            token,
                        };
                        let msg = JsValue::from_serde(&msg)
                            .expect("Failed to serialize CHECK_UPDATE message");
                        controller.post_message(&msg).ok();
                    }
                }
            }
        });
    }

    let timer = {
        let loading = loading.clone();
        let props_loading = props.loading;
        use_timeout(
            move || {
                log::debug!("Toggling spinner timer");
                loading.set(props_loading);
            },
            600,
        )
    };

    if props.loading && !*loading {
        log::debug!("Resetting spinner timer");
        timer.reset();
    } else {
        log::debug!("Canceling spinner timer");
        timer.cancel();
    }

    let selected_css = |route| {
        if Some(route) == props.selected_page {
            "-solid !text-amber-500".to_string()
        } else {
            String::default()
        }
    };

    let month_cal_toggle = {
        let show_month_cal = show_month_cal.clone();
        Callback::from(move |_| {
            show_month_cal.toggle();
        })
    };

    let month_cal_button = props
        .calendar
        .as_ref()
        .map(|_| HeaderButtonProps::month_calendar(month_cal_toggle.clone()));

    let left_buttons = month_cal_button
        .iter()
        .chain(props.left_button.iter())
        .collect::<Vec<_>>();

    let right_buttons = props
        .right_button
        .iter()
        .chain(props.right_button2.iter())
        .collect::<Vec<_>>();

    html! {
        <>
            <div
                class="bg-hero dark:bg-herod bg-no-repeat bg-cover bg-center h-screen w-full fixed -z-10"
            />
            if !network_status.online {
                <div
                    class="absolute bg-red-500 w-full h-4 top-[env(safe-area-inset-top)] z-10 overscroll-none"
                >
                    <p class="text-white text-center overflow-hidden text-xs">
                        { Locale::current().offline_msg() }
                    </p>
                </div>
            }
            <div
                id="content"
                class={format!(
                        "fixed pt-safe-top top-0 {} left-0 right-0 overflow-y-auto {}",
                        if props.show_footer {"bottom-16"} else {"bottom-0"},
                        if !network_status.online {"top-4"} else {""})}
            >
                // 100vh-4rem means screen minus bottom-16; env(...) - the height of iPhone notch
                <div
                    class="bg-transparent min-h-[calc(100vh-4rem-env(safe-area-inset-top))] justify-center items-center py-[calc(0.5rem-env(safe-area-inset-top))] sm:py-[calc(3rem-env(safe-area-inset-top))]"
                >
                    if props.loading && *loading {
                        <div
                            class="bg-gray-500 bg-opacity-50 fixed left-0 top-0 z-10 h-full w-full overflow-hidden flex"
                        >
                            <div
                                class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-10 w-10 m-auto"
                            />
                        </div>
                    }
                    <div
                        class="w-full text-center relative"
                    >
                        <div class="absolute flex w-full h-full flex-col justify-center px-4">
                            <div class="relative">
                                <div
                                    class="relative sm:max-w-md md:max-w-md lg:max-w-lg xl:max-w-lg 2xl:max-w-lg mx-auto"
                                >
                                    <div class="relative flex justify-between py-10">
                                        { header_button(&left_buttons, nav.clone(), show_ctx_menu.clone()) }
                                        { header_button(&right_buttons, nav.clone(), show_ctx_menu.clone()) }
                                    </div>
                                </div>
                            </div>
                        </div>
                        <img class="logo h-20 inline-block" src="/images/logo.png" />
                    </div>
                    <div
                        class="relative sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto"
                    >
                        <div
                            class="relative px-4 py-4 rounded-3xl sm:px-20 md:px-20 lg:px-20 xl:px-30 2xl:px-30"
                        >
                            { for props.header_label.iter().map(|l| {
                                html! {
                                    <div class="pb-5 text-center">
                                        <h5 class="text-xl font-medium text-zinc-500 dark:text-zinc-100">{l}</h5>
                                        {for props.header_sub_label.iter().map(|sl| {
                                            html!{<span class="text-sm text-zinc-300 dark:text-zinc-200">{sl}</span>}
                                        })}
                                    </div>
                                }}) }
                            if *show_month_cal {
                                <MonthCalendar
                                    close={month_cal_toggle.clone()}
                                    highlight_incomplete_dates={props.calendar.as_ref().map(|cal| cal.highlight_incomplete_dates).unwrap_or(false)}
                                />
                            }
                            if let Some(cal) = &props.calendar {
                                <Calendar
                                    highlight_incomplete_dates={cal.highlight_incomplete_dates}
                                    selected_date_incomplete={cal.selected_date_incomplete}
                                />
                            }
                            { props.children.clone() }
                        </div>
                    </div>
                </div>
            </div>
            if props.show_footer {
                <div
                    id="footer"
                    class="fixed bottom-0 left-0 z-10 w-full h-16 bg-white/50 border-t border-zinc-200/50 dark:bg-zinc-700/50  dark:border-zinc-700/50"
                >
                    <div class="bg-transparent justify-center">
                        <div class="relative py-3 sm:max-w-xl sm:mx-auto">
                            <div class="relative px-8 sm:rounded-3xl sm:px-20">
                                <div class={MENU_CSS}>
                                    <span>
                                        <Link<AppRoute> to={AppRoute::Home}>
                                            <i
                                                class={format!("icon-home{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Home))}
                                            />
                                        </Link<AppRoute>>
                                    </span>
                                    <span>
                                        <Link<AppRoute> to={AppRoute::Charts}>
                                            <i
                                                class={format!("icon-graph{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Charts))}
                                            />
                                        </Link<AppRoute>>
                                    </span>
                                    <span>
                                        <Link<AppRoute> to={AppRoute::Yatras}>
                                            <i
                                                class={format!("icon-user-group{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Yatras))}
                                            />
                                        </Link<AppRoute>>
                                    </span>
                                    <span>
                                        <Link<AppRoute> to={AppRoute::Settings}>
                                            <i
                                                class={format!("icon-adjust{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Settings))}
                                            />
                                        </Link<AppRoute>>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </>
    }
}
