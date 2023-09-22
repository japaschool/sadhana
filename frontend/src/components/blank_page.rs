use yew::{html::onclick::Event, prelude::*};
use yew_hooks::{use_bool_toggle, use_timeout};
use yew_router::prelude::*;

use crate::{css::*, i18n::Locale, routes::AppRoute};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub header_label: Option<String>,
    #[prop_or_default]
    pub header_sub_label: Option<String>,
    #[prop_or_default]
    pub prev_link: Option<(String, AppRoute)>,
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
    pub children: Children,
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
pub struct HeaderButtonProps {
    label: String,
    icon_css: Option<String>,
    onclick: Callback<Event>,
    btn_type: ButtonType,
}

impl HeaderButtonProps {
    pub fn new<S: Into<String>>(
        label: S,
        onclick: Callback<Event>,
        icon_css: Option<String>,
        btn_type: ButtonType,
    ) -> Self {
        HeaderButtonProps {
            label: label.into(),
            icon_css,
            onclick,
            btn_type,
        }
    }

    pub fn edit(onclick: Callback<Event>) -> Self {
        Self::new(Locale::current().edit(), onclick, None, ButtonType::Button)
    }

    pub fn submit<S: Into<String>>(label: S) -> Self {
        Self::new(label.into(), Callback::default(), None, ButtonType::Submit)
    }

    pub fn reset<S: Into<String>>(label: S) -> Self {
        Self::new(label.into(), Callback::default(), None, ButtonType::Reset)
    }

    pub fn blank() -> Self {
        Self::new("", Callback::default(), None, ButtonType::Button)
    }

    pub fn back(onclick: Callback<Event>) -> Self {
        Self::new(
            Locale::current().back(),
            onclick,
            Some("icon-chevron-left".into()),
            ButtonType::Button,
        )
    }
}

fn header_button(props: &Option<HeaderButtonProps>) -> Html {
    if let Some(ref rb) = props {
        html! {
            <span class="text-zinc-500 ">
                <button type={ rb.btn_type.as_str() } class={ LINK_CSS } onclick={ rb.onclick.clone() }>
                    <i class={ format!("{}", rb.icon_css.to_owned().unwrap_or_default()) }></i>
                    { &rb.label }
                </button>
            </span>
        }
    } else {
        html! {}
    }
}

#[function_component(BlankPage)]
pub fn blank_page(props: &Props) -> Html {
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
            <div id="content" class={ format!("fixed top-0 {} left-0 right-0 overflow-y-auto", if props.show_footer {"bottom-16"} else {"bottom-0"}) }>
                <div class="bg-transparent min-h-screen justify-center items-center py-6 sm:py-12">
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
                                        {
                                            if let Some((ref label, ref route)) = props.prev_link {
                                                html! {
                                                    <span>
                                                        <Link<AppRoute> classes={ LINK_CSS } to={ route.clone() }>
                                                            <i class="icon-chevron-left"></i>
                                                            {label}
                                                        </Link<AppRoute>>
                                                    </span>
                                                }
                                            } else {
                                                header_button(&props.left_button)
                                            }
                                        }
                                        { header_button(&props.right_button) }
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
