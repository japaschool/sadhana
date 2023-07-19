use yew::prelude::*;

use crate::{
    components::{blank_page::BlankPage, chart::Chart, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::{PracticeDataType, PracticeEntryValue, ReportDataEntry, UserPractice},
    services::{get_chart_data, get_shared_chart_data, get_shared_practices, get_user_practices},
};

#[function_component(Yatras)]
pub fn yatras() -> Html {
    let members = vec![
        "Alex Antonov das",
        "Yogapati prabhu",
        "Ruslan prabhu",
        "Nikita prabhu",
        "Alexandr Chekushin prabhu",
        "alskjdnvaldkjfbn das",
        "davf werg wer prabhu",
        "Vishaka mataji",
        "Jai Nitai prabhu",
        "`sdvasbadrh grea prabhu",
    ];

    let practices = vec![
        "Sadhaka",
        "Wake Up Time",
        "Night Time",
        "Total Rounds",
        "Books",
    ];

    let header = practices
        .iter()
        .enumerate()
        .map(|(idx, nm)| {
            let css = if idx == 0 { "" } else { "-rotate-90" };
            html! {
                <th class={css}><td>{ nm }</td></th>
            }
        })
        .collect::<Html>();

    html! {
            <BlankPage show_footer=true /*loading={all_practices.data.is_none()}*/>
                // <ListErrors error={all_practices.error.clone()} />
                // <ListErrors error={report_data.error.clone()} />
                <div class={ BODY_DIV_CSS }>

    <div class="relative overflow-x-auto shadow-md sm:rounded-lg">
    <div class="flex items-center justify-between pb-4 bg-white bg-opacity-50 dark:bg-gray-900">
    <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400 table-auto">
        <thead class="text-xs uppercase bg-gray-50 bg-opacity-50 dark:bg-gray-700 dark:bg-opacity-50 dark:text-gray-400">
            <tr>
                <th scope="col" class="px-6 py-3">
                    {"Sadhaka"}
                </th>
                <th scope="col" class="px-6 py-3">
                    {"Wake Up Time"}
                </th>
                <th scope="col" class="px-6 py-3">
                    {"Night Time"}
                </th>
                <th scope="col" class="px-6 py-3">
                    {"Total Rounds"}
                </th>
                <th scope="col" class="px-6 py-3">
                    {"Books"}
                </th>
                <th scope="col" class="px-6 py-3">
                    {"Lectures"}
                </th>
            </tr>
        </thead>
        <tbody>
            <tr class="bg-white bg-opacity-50 border-b dark:bg-gray-800 dark:bg-opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" class="flex items-center px-6 py-4 text-gray-400 whitespace-nowrap dark:text-gray-300">
                        <div class="text-sm font-semibold">{"Alex Antonov das"}</div>
                </th>
                <td class="px-6 py-4">
                    {"4:42"}
                </td>
                <td class="px-6 py-4">
                    {"22:20"}
                </td>
                <td class="px-6 py-4">
                    {"18"}
                </td>
                <td class="px-6 py-4">
                    {"30m"}
                </td>
                <td class="px-6 py-4">
                    {"1h15m"}
                </td>
            </tr>
            <tr class="bg-white bg-opacity-50 border-b dark:bg-gray-800 dark:bg-opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" class="flex items-center px-6 py-4 font-medium text-gray-400 whitespace-nowrap dark:text-gray-300">
                        <div class="text-sm font-semibold">{"Yogapati prabhu"}</div>
                </th>
                <td class="px-6 py-4">
                    {"3:30"}
                </td>
                <td class="px-6 py-4">
                    {"21:30"}
                </td>
                <td class="px-6 py-4">
                    {"32"}
                </td>
                <td class="px-6 py-4">
                    {"1h"}
                </td>
                <td class="px-6 py-4">
                    {"2h15m"}
                </td>
            </tr>
            <tr class="bg-white bg-opacity-50 border-b dark:bg-gray-800 dark:bg-opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" class="flex items-center px-6 py-4 font-medium text-gray-400 whitespace-nowrap dark:text-gray-300">
                        <div class="text-sm font-semibold">{"Ruslan prabhu"}</div>
                </th>
                <td class="px-6 py-4">
                    {"5:00"}
                </td>
                <td class="px-6 py-4">
                    {"23:00"}
                </td>
                <td class="px-6 py-4">
                    {"16"}
                </td>
                <td class="px-6 py-4">
                    {"45m"}
                </td>
                <td class="px-6 py-4">
                    {"1h"}
                </td>
            </tr>
            <tr class="bg-white bg-opacity-50 border-b dark:bg-gray-800 dark:bg-opacity-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" class="flex items-center px-6 py-4 font-medium text-gray-400 whitespace-nowrap dark:text-gray-300">
                        <div class="text-sm font-semibold">{"Thomas Lean"}</div>
                </th>
                <td class="px-6 py-4">
                    {"4:45"}
                </td>
                <td class="px-6 py-4">
                    {"22:30"}
                </td>
                <td class="px-6 py-4">
                    {"16"}
                </td>
                <td class="px-6 py-4">
                    {"50m"}
                </td>
                <td class="px-6 py-4">
                    {"1h30m"}
                </td>
            </tr>
            <tr class="bg-white bg-opacity-50 dark:bg-gray-800 dark:bg-opacity-50 hover:bg-gray-50 dark:hover:bg-gray-600">
                <th scope="row" class="flex items-center px-6 py-4 font-medium text-gray-400 whitespace-nowrap dark:text-gray-300">
                        <div class="text-sm font-semibold">{"Nikita prabhu"}</div>
                </th>
                <td class="px-6 py-4">
                    {"6:10"}
                </td>
                <td class="px-6 py-4">
                    {"23:20"}
                </td>
                <td class="px-6 py-4">
                    {"16"}
                </td>
                <td class="px-6 py-4">
                    {"15m"}
                </td>
                <td class="px-6 py-4">
                    {"45m"}
                </td>
            </tr>
        </tbody>
    </table>
    </div>
    </div>
    </div>
            </BlankPage>
        }
}
