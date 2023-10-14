use std::rc::Rc;

use chrono::NaiveDate;
use yew::{html::onclick::Event, prelude::*};
use yew_hooks::{use_bool_toggle, use_timeout};
use yew_router::prelude::*;

use super::{calendar::Calendar, month_calendar::MonthCalendar};
use crate::{css::*, i18n::Locale, routes::AppRoute};

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
    pub selected_date: NaiveDate,
    pub highlight_date: Option<Callback<Rc<NaiveDate>, bool>>,
    pub date_onchange: Callback<NaiveDate>,
    pub show_month_calendar: bool,
    pub month_calendar_onclose: Callback<()>,
}

impl CalendarProps {
    pub fn new(
        selected_date: NaiveDate,
        date_onchange: Callback<NaiveDate>,
        highlight_date: Callback<Rc<NaiveDate>, bool>,
        show_month_calendar: bool,
        month_calendar_onclose: Callback<()>,
    ) -> Self {
        Self {
            show_month_calendar,
            selected_date,
            highlight_date: Some(highlight_date),
            date_onchange,
            month_calendar_onclose,
        }
    }

    pub fn week(selected_date: NaiveDate, date_onchange: Callback<NaiveDate>) -> Self {
        Self {
            show_month_calendar: false,
            selected_date,
            highlight_date: None,
            date_onchange,
            month_calendar_onclose: Callback::default(),
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
        HeaderButtonProps {
            label: Some(label.into()),
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
        HeaderButtonProps {
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
        HeaderButtonProps {
            label: None,
            icon_css: Some(icon_css.into()),
            action: Action::Cb(onclick),
            btn_type,
        }
    }

    pub fn new_icon_redirect<S: Into<String>>(route: AppRoute, icon_css: S) -> Self {
        HeaderButtonProps {
            label: None,
            icon_css: Some(icon_css.into()),
            action: Action::Redirect(route),
            btn_type: ButtonType::Button,
        }
    }

    pub fn edit(onclick: Callback<Event>) -> Self {
        Self::new_cb(Locale::current().edit(), onclick, None, ButtonType::Button)
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
}

fn header_button(props: &Option<HeaderButtonProps>, nav: Navigator) -> Html {
    if let Some(ref rb) = props {
        let css = format!(
            "{} {HEADER_BUTTON_CSS}",
            if rb.label.is_some() {
                "text-base"
            } else {
                "text-xl"
            }
        );

        let nav = nav.clone();
        let onclick = {
            match &rb.action {
                Action::Cb(cb) => cb.clone(),
                Action::Redirect(to) => {
                    let route = to.clone();
                    Callback::from(move |_| nav.push(&route))
                }
                Action::NavBack => Callback::from(move |_| nav.back()),
            }
        };

        html! {
            <span>
                <button type={rb.btn_type.as_str()} class={css} onclick={onclick}>
                    <i class={format!("text-2xl {}", rb.icon_css.to_owned().unwrap_or_default())}></i>
                    if let Some(l) = rb.label.as_ref() {
                        {l}
                    }
                </button>
            </span>
        }
    } else {
        html! {}
    }
}

pub const HEADER_BUTTON_CSS: &'static str = "no-underline text-amber-400";

#[function_component(BlankPage)]
pub fn blank_page(props: &Props) -> Html {
    let nav = use_navigator().unwrap();
    let loading = use_bool_toggle(false);

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

    html! {
        <>
            <div class="bg-hero dark:bg-herod bg-no-repeat bg-cover bg-center h-screen w-full fixed -z-10" />
            <div id="content" class={ format!("fixed pt-safe-top top-0 {} left-0 right-0 overflow-y-auto", if props.show_footer {"bottom-16"} else {"bottom-0"}) }>
                // 100vh-4rem means screen minus bottom-16; env(...) - the height of iPhone notch
                <div class="bg-transparent min-h-[calc(100vh-4rem-env(safe-area-inset-top))] justify-center items-center py-[calc(1.5rem-env(safe-area-inset-top))] sm:py-[calc(3rem-env(safe-area-inset-top))]">
                    if props.loading && *loading {
                        <div class="bg-gray-500 bg-opacity-50 fixed left-0 top-0 z-50 h-full w-full overflow-hidden flex">
                            <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-10 w-10 m-auto"/>
                        </div>
                    }
                    <div class="w-full text-center relative">
                        <div class="absolute flex w-full h-full flex-col justify-center px-4">
                            <div class="relative">
                                <div class="relative sm:max-w-md md:max-w-md lg:max-w-lg xl:max-w-lg 2xl:max-w-lg mx-auto">
                                    <div class="relative flex justify-between py-10">
                                        {header_button(&props.left_button, nav.clone())}
                                        {header_button(&props.right_button, nav.clone())}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <img class="logo h-20 inline-block" src="/images/logo.png" />
                    </div>
                    <div class="relative sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-7xl mx-auto">
                        <div class="relative px-4 py-4 rounded-3xl sm:px-20 md:px-20 lg:px-20 xl:px-30 2xl:px-30">
                            {for props.header_label.iter().map(|l| {
                                html! {
                                    <div class="pb-5 text-center">
                                        <h5 class="text-xl font-medium text-zinc-500 dark:text-zinc-100">{l}</h5>
                                        {for props.header_sub_label.iter().map(|sl| {
                                            html!{<span class="text-sm text-zinc-300 dark:text-zinc-200">{sl}</span>}
                                        })}
                                    </div>
                                }})
                            }
                            if let Some(cal) = props.calendar.as_ref() {
                                if cal.show_month_calendar {
                                    <MonthCalendar
                                        selected_date={cal.selected_date}
                                        date_onchange={cal.date_onchange.clone()}
                                        close={cal.month_calendar_onclose.clone()}
                                        />
                                }
                            }
                            if let Some(cal) = props.calendar.as_ref() {
                                <Calendar
                                    selected_date={cal.selected_date}
                                    date_onchange={cal.date_onchange.clone()}
                                    highlight_date={cal.highlight_date.clone()}
                                    />
                            }
                            { props.children.clone() }
                        </div>
                    </div>
                </div>
            </div>
            if props.show_footer {
                <div id="footer" class="fixed bottom-0 left-0 z-50 w-full h-16 bg-white/50 border-t border-zinc-200/50 dark:bg-zinc-700/50  dark:border-zinc-700/50">
                    <div class="bg-transparent justify-center">
                        <div class="relative py-3 sm:max-w-xl sm:mx-auto">
                            <div class="relative px-8 sm:rounded-3xl sm:px-20">
                                <div class={ MENU_CSS }>
                                    <span><Link<AppRoute> to={AppRoute::Home}><i class={ format!("icon-home{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Home)) }/></Link<AppRoute>></span>
                                    <span><Link<AppRoute> to={AppRoute::Charts}><i class={ format!("icon-graph{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Charts)) }/></Link<AppRoute>></span>
                                    <span><Link<AppRoute> to={AppRoute::Yatras}><i class={ format!("icon-user-group{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Yatras)) }/></Link<AppRoute>></span>
                                    <span><Link<AppRoute> to={AppRoute::Settings}><i class={ format!("icon-adjust{} {FOOTER_ICON_CSS}", selected_css(AppRoute::Settings)) }/></Link<AppRoute>></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </>
    }
}
