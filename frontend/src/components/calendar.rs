use chrono::{prelude::*, Days};
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::i18n::Locale;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub selected_date: NaiveDate,
    pub date_onchange: Callback<NaiveDate>,
}

#[function_component(Calendar)]
pub fn calendar(props: &Props) -> Html {
    let today: NaiveDate = Local::now().date_naive();
    let selected_date = use_state(|| props.selected_date);
    let week = use_state(|| vec![Local::now().date_naive()]);

    {
        let week = week.clone();
        let callback = props.date_onchange.clone();
        use_effect_with_deps(
            move |d| {
                callback.emit(**d);
                let d = d.week(Weekday::Mon).first_day();
                let mut res = vec![d.clone()];
                for i in 1..7 {
                    res.push(d.clone().checked_add_days(Days::new(i)).unwrap());
                }
                week.set(res);
                || ()
            },
            selected_date.clone(),
        );
    }

    const DATE_FORMAT: &'static str = "%Y-%m-%d";

    let onclick_date = {
        let selected_date = selected_date.clone();
        Callback::from(move |ev: MouseEvent| {
            let input: HtmlInputElement = ev.target_unchecked_into();
            let new_date = NaiveDate::parse_from_str(input.id().as_str(), DATE_FORMAT).unwrap();
            selected_date.set(new_date);
        })
    };

    let next_week_onclick = {
        let selected_date = selected_date.clone();
        Callback::from(move |_: MouseEvent| {
            selected_date.set(selected_date.checked_add_days(Days::new(7)).unwrap());
        })
    };

    let prev_week_onclick = {
        let selected_date = selected_date.clone();
        Callback::from(move |_: MouseEvent| {
            selected_date.set(selected_date.checked_sub_days(Days::new(7)).unwrap());
        })
    };

    const HOVER_TODAY_DATE_DIV_CSS: &'static str = "flex group dark:hover:bg-amber-400 rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const HOVER_DATE_DIV_CSS: &'static str = "flex group hover:bg-zinc-300 dark:hover:bg-slate-800 rounded-full mt-2 mx-1 transition-all duration-300 cursor-pointer justify-center h-8 w-8";
    const SELECTED_TODAY_DATE_DIV_CSS: &'static str = "flex group text-white bg-amber-400 rounded-full mt-2 mx-1 cursor-pointer justify-center h-9 w-9";
    const SELECTED_DATE_DIV_CSS: &'static str = "flex group text-white rounded-full border-2 border-amber-400 mt-2 mx-1 cursor-pointer justify-center h-9 w-9";

    let calendar_day = |for_selected_date: bool, d: &NaiveDate| -> Html {
        let date_css = match (for_selected_date, *d == today) {
            (true, true) => SELECTED_TODAY_DATE_DIV_CSS,
            (true, false) => SELECTED_DATE_DIV_CSS,
            (false, true) => HOVER_TODAY_DATE_DIV_CSS,
            (false, false) => HOVER_DATE_DIV_CSS,
        };
        let weekday_label_css = if for_selected_date {
            "text-zinc-500  dark:text-zinc-100 text-base font-semibold"
        } else {
            "text-zinc-500  dark:text-zinc-100 text-base"
        };
        let date_label_css = if for_selected_date {
            "text-zinc-500  dark:text-zinc-100 my-auto font-bold"
        } else {
            "text-zinc-500  dark:text-zinc-100 dark:group-hover:text-white group-hover:text-zinc-100 my-auto group-hover:font-bold transition-all duration-300"
        };

        let id = d.format(DATE_FORMAT);

        html! {
            <div class="text-center">
                <p class={ weekday_label_css }>{ &Locale::current().day_of_week(d).chars().nth(0).unwrap() }</p>
                <div class={ date_css } id={ id.to_string() } onclick={ onclick_date.clone() }>
                    <p id={ id.to_string() } class={ date_label_css }>{ d.format("%-d") }</p>
                </div>
            </div>
        }
    };

    html! {
        <div class="relative">
            <div class="flex justify-center overflow-x-scroll mx-auto">
                <div class="flex text-zinc-500 dark:text-zinc-100 group w-16" onclick={ prev_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-left"></i></div>
                </div>
                {
                    week.iter().map(|d| html! {
                        <div class="flex group justify-center w-16">
                            <div class="flex items-center">{ calendar_day(*d == *selected_date, d) }</div>
                        </div>
                    }).collect::<Html>()
                }
                <div class="flex text-zinc-500 dark:text-zinc-100 justify-end group w-16" onclick={ next_week_onclick.clone() }>
                    <div class="flex items-center"><i class="icon-chevron-right"></i></div>
                </div>
            </div>
        </div>
    }
}
