use std::rc::Rc;

use chrono::{prelude::*, Days};
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::i18n::Locale;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub selected_date: NaiveDate,
    pub date_onchange: Callback<NaiveDate>,
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

    let week = {
        let d = props.selected_date.week(Weekday::Mon).first_day();
        let mut res = vec![d];
        for i in 1..7 {
            res.push(d.checked_add_days(Days::new(i)).unwrap());
        }
        res
    };

    let onclick_date = {
        let cb = props.date_onchange.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let new_date = NaiveDate::parse_from_str(input.id().as_str(), DATE_FORMAT).unwrap();
            cb.emit(new_date);
        })
    };

    let next_week_onclick = {
        let cb = props.date_onchange.clone();
        let selected_date = props.selected_date;
        Callback::from(move |_: MouseEvent| {
            if selected_date.weekday() == Weekday::Sun {
                cb.emit(selected_date.succ_opt().unwrap());
            } else {
                cb.emit(selected_date.checked_add_days(Days::new(7)).unwrap());
            }
        })
    };

    let prev_week_onclick = {
        let cb = props.date_onchange.clone();
        let selected_date = props.selected_date;
        Callback::from(move |_: MouseEvent| {
            if selected_date.weekday() == Weekday::Mon {
                cb.emit(selected_date.pred_opt().unwrap());
            } else {
                cb.emit(selected_date.checked_sub_days(Days::new(7)).unwrap());
            }
        })
    };

    let ondblclick = {
        let cb = props.date_onchange.clone();
        Callback::from(move |_: MouseEvent| {
            cb.emit(today);
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
                    <p id={id.to_string()} class={ date_label_css }>{ d.format("%-d") }</p>
                </div>
            </div>
        }
    };

    html! {
        <div class="relative" {ondblclick} >
            <div class="pb-5 flex justify-center overflow-x-scroll mx-auto max-w-sm">
                <div class="flex text-zinc-500 dark:text-zinc-100 group w-16" onclick={ prev_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-left"></i></div>
                </div>
                {for week.iter().map(|d| html! {
                    <div class="flex group justify-center w-16">
                        <div class="flex items-center">
                        { calendar_day(*d == props.selected_date, d) }
                        </div>
                    </div>
                })}
                <div class="flex text-zinc-500 dark:text-zinc-100 justify-end group w-16" onclick={ next_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-right"></i></div>
                </div>
            </div>
        </div>
    }
}
