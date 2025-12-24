use tw_merge::*;
use yew::prelude::*;

use crate::model::PracticeEntryValue;

#[derive(Properties, Clone, PartialEq)]
pub struct GridProps {
    pub header: Vec<String>,
    pub data: Vec<Vec<Option<PracticeEntryValue>>>,
    #[prop_or_default]
    pub color_coding: Vec<Option<Callback<PracticeEntryValue, HeatmapColors>>>,
}

#[derive(Clone, PartialEq)]
pub enum HeatmapColors {
    Red,
    Green,
    Amber,
    NA,
}

impl HeatmapColors {
    fn css(&self) -> &'static str {
        match self {
            HeatmapColors::Red => "bg-red-200 dark:bg-red-800",
            HeatmapColors::Green => "bg-green-200 dark:bg-green-800",
            HeatmapColors::Amber => "bg-amber-200 dark:bg-amber-800",
            HeatmapColors::NA => "",
        }
    }
}

#[function_component(Grid)]
pub fn grid(props: &GridProps) -> Html {
    let color_coding_cbs = || {
        if !props.color_coding.is_empty() {
            props.color_coding.clone()
        } else {
            vec![None; props.header.len()]
        }
    };

    html! {
        <div class="relative scroll-smooth hover:scroll-auto overflow-x-auto shadow-md border dark:border-zinc-200 border-zinc-400 rounded-lg">
            <div class="flex items-center justify-between pb-4">
                <table class="w-full text-sm text-left text-zinc-400 dark:text-zinc-200 table-auto bg-white dark:bg-zinc-700 bg-opacity-30 dark:bg-opacity-30">
                    <thead class="text-xs uppercase dark:bg-zinc-500 dark:text-zinc-200 text-zinc-400 bg-opacity-30 dark:bg-opacity-30">
                        <tr>
                            {for props.header.iter().map(|hd| html! {
                                <th scope="col" class="px-3 py-3">
                                    <div class="text-sm font-normal">{ hd }</div>
                                </th>
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {for props.data.iter().map(|row|
                            html! {
                                <tr class="bg-white bg-opacity-40 dark:bg-opacity-40 dark:bg-zinc-800 dark:border-zinc-700 border-b hover:bg-zinc-50 dark:hover:bg-zinc-600">
                                    {for row.iter().zip(color_coding_cbs()).enumerate().map(|(idx, (cell, cc))|
                                        if idx == 0 {
                                            html! {
                                                <th scope="row" class="flex items-center px-3 py-4 text-zinc-400 whitespace-nowrap dark:text-zinc-300">
                                                    <div class="text-sm font-normal">{ cell.as_ref().map(|v|v.to_string()).unwrap_or_default() }</div>
                                                </th>
                                            }
                                        } else {
                                            let cc_css = cc.as_ref().map(|cb| cell.as_ref().map(|v| cb.emit(v.to_owned()).css()));
                                            html! {
                                                <td class={tw_merge!("px-3 py-4", cc_css)}>
                                                    { cell.as_ref().map(|v| v.to_string()).unwrap_or_default() }
                                                </td>
                                            }
                                        }
                                    )}
                                </tr>
                            }
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    }
}
