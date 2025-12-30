use tw_merge::*;
use yew::prelude::*;

use crate::model::{PracticeEntryValue, ZoneColour};

#[derive(Properties, Clone, PartialEq)]
pub struct GridProps {
    #[prop_or_default]
    pub header: Vec<String>,
    pub data: Vec<Vec<Option<PracticeEntryValue>>>,
    #[prop_or_default]
    pub color_coding: Option<Callback<PracticeEntryValue, ZoneColour>>,
    #[prop_or(true)]
    pub first_column_highlighted: bool,
}

#[function_component(Grid)]
pub fn grid(props: &GridProps) -> Html {
    html! {
        <div
            id="grid"
            class="relative scroll-smooth hover:scroll-auto overflow-x-auto shadow-md border dark:border-zinc-200 border-zinc-400 rounded-lg"
        >
            <div class="flex items-center justify-between">
                <table class="w-full text-sm text-left text-zinc-400 dark:text-zinc-200 table-auto bg-white dark:bg-zinc-700 bg-opacity-30 dark:bg-opacity-30">
                    if !props.header.is_empty() {
                        <thead class="text-xs uppercase dark:bg-zinc-500 dark:text-zinc-200 text-zinc-400 bg-opacity-30 dark:bg-opacity-30">
                            <tr>
                                {for props.header.iter().map(|hd| html! {
                                    <th scope="col" class="px-3 py-3">
                                        <div class="text-sm font-normal">{ hd }</div>
                                    </th>
                                })}
                            </tr>
                        </thead>
                    }
                    <tbody>
                        {for props.data.iter().map(|row|
                            html! {
                                <tr class="bg-white bg-opacity-40 dark:bg-opacity-40 dark:bg-zinc-800 dark:border-zinc-700 border-b hover:bg-zinc-50 dark:hover:bg-zinc-600">
                                    {for row.iter().enumerate().map(|(idx, cell)|
                                        if idx == 0 && props.first_column_highlighted {
                                            html! {
                                                <th scope="row" class="flex items-center px-3 py-4 text-zinc-400 whitespace-nowrap dark:text-zinc-300">
                                                    <div class="text-sm font-normal">{ cell.as_ref().map(|v|v.to_string()).unwrap_or_default() }</div>
                                                </th>
                                            }
                                        } else {
                                            let cc_css = props.color_coding.as_ref().map(|cb| cell.as_ref().map(|v| zone_css(&cb.emit(v.to_owned()))));
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

fn zone_css(zone: &ZoneColour) -> &'static str {
    match zone {
        ZoneColour::Red => "bg-red-500/10 dark:bg-red-400/20",
        ZoneColour::Green => "bg-green-500/10 dark:bg-green-400/20",
        ZoneColour::Yellow => "bg-amber-500/10 dark:bg-amber-400/20",
        ZoneColour::Neutral => "",
    }
}
