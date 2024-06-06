use std::rc::Rc;

use chrono::{prelude::*, Days};
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::{hooks::SessionStateContext, i18n::Locale};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub highlight_date: Option<Callback<Rc<NaiveDate>, bool>>,
}

pub const DATE_FORMAT: &str = "%Y-%m-%d";

const DATE_CSS: &str =
    "flex group rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center";

pub const HOVER_TODAY_DATE_COLOR_CSS: &str = "hover:bg-amber-400 dark:hover:bg-amber-400";
pub const HOVER_DATE_COLOR_CSS: &str = "hover:bg-zinc-300 dark:hover:bg-slate-800";
pub const SELECTED_TODAY_DATE_COLOR_CSS: &str = "bg-amber-400";
pub const SELECTED_DATE_COLOR_CSS: &str = "border-2 border-amber-400";

#[function_component(Calendar)]
pub fn calendar(props: &Props) -> Html {
    let today: NaiveDate = Local::now().date_naive();
    let session_state =
        use_context::<SessionStateContext>().expect("No session state context found");

    let week = {
        let d = session_state.selected_date.week(Weekday::Mon).first_day();
        let mut res = vec![d];
        for i in 1..7 {
            res.push(d.checked_add_days(Days::new(i)).unwrap());
        }
        res
    };

    let selected_date_str = session_state
        .selected_date
        .format_localized("%A %e %B %Y", Locale::current().chrono())
        .to_string();

    let onclick_date = {
        let ss = session_state.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let new_date = NaiveDate::parse_from_str(input.id().as_str(), DATE_FORMAT).unwrap();
            ss.dispatch(new_date);
        })
    };

    let next_week_onclick = {
        let selected_date = session_state.selected_date;
        let ss = session_state.clone();
        Callback::from(move |_: MouseEvent| {
            let new_date = if selected_date.weekday() == Weekday::Sun {
                selected_date.succ_opt().unwrap()
            } else {
                selected_date.checked_add_days(Days::new(7)).unwrap()
            };
            ss.dispatch(new_date);
        })
    };

    let prev_week_onclick = {
        let selected_date = session_state.selected_date;
        let ss = session_state.clone();
        Callback::from(move |_: MouseEvent| {
            let new_date = if selected_date.weekday() == Weekday::Mon {
                selected_date.pred_opt().unwrap()
            } else {
                selected_date.checked_sub_days(Days::new(7)).unwrap()
            };
            ss.dispatch(new_date);
        })
    };

    let ondblclick = {
        let ss = session_state.clone();
        Callback::from(move |_: MouseEvent| {
            ss.dispatch(today);
        })
    };

    let calendar_day = |for_selected_date: bool, d: &NaiveDate| -> Html {
        let date_css = match (for_selected_date, *d == today) {
            (true, true) => format!("{SELECTED_TODAY_DATE_COLOR_CSS} h-9 w-9"),
            (true, false) => format!("{SELECTED_DATE_COLOR_CSS} h-8 w-8"),
            (false, true) => format!("{HOVER_TODAY_DATE_COLOR_CSS} h-8 w-8"),
            (false, false) => format!("{HOVER_DATE_COLOR_CSS} h-8 w-8"),
        };
        let mut weekday_label_css = "text-zinc-500 dark:text-zinc-100 text-xs".into();
        if for_selected_date {
            weekday_label_css = format!("{weekday_label_css} font-semibold");
        }
        let date_label_css = if for_selected_date {
            "text-zinc-500 dark:text-zinc-100 my-auto font-bold"
        } else {
            "text-zinc-500 dark:text-zinc-100 dark:group-hover:text-white group-hover:text-zinc-100 my-auto group-hover:font-bold transition-all duration-300"
        };

        let id = d.format(DATE_FORMAT);

        let highlight = html! {
            for props.highlight_date.iter().filter(|cb| cb.emit(Rc::new(*d))).map(|_| html! {
                <span id={id.to_string()} class="absolute ml-4 w-2 h-2 bg-red-500 rounded-full"></span>
            })
        };

        html! {
            <div id={id.to_string()} class="text-center">
                <p id={id.to_string()} class={ weekday_label_css }>{ &Locale::current().day_of_week(d).chars().next().unwrap() }</p>
                <div id={id.to_string()} class={ format!("{DATE_CSS} {date_css}") } onclick={ onclick_date.clone() }>
                    {highlight}
                    <p id={id.to_string()} class={ date_label_css }>{ d.format("%-d").to_string() }</p>
                </div>
            </div>
        }
    };

    html! {
        <div class="relative" {ondblclick} >
            <div class="pb-1 flex justify-center overflow-x-scroll mx-auto max-w-sm">
                <div class="flex text-zinc-500 dark:text-zinc-100 group w-16" onclick={ prev_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-left"></i></div>
                </div>
                {for week.iter().map(|d| html! {
                    <div class="flex group justify-center w-16">
                        <div class="flex items-center">
                        { calendar_day(*d == session_state.selected_date, d) }
                        </div>
                    </div>
                })}
                <div class="flex text-zinc-500 dark:text-zinc-100 justify-end group w-16" onclick={ next_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-right"></i></div>
                </div>
            </div>
            <div class="flex justify-center">
                <p class="text-sm dark:text-zinc-100 text-zinc-500">{selected_date_str}</p>
            </div>
        </div>
    }
}
