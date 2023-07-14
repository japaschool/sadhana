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
    ];

    html! {
        <BlankPage show_footer=true /*loading={all_practices.data.is_none()}*/>
            // <ListErrors error={all_practices.error.clone()} />
            // <ListErrors error={report_data.error.clone()} />
            <div class={ BODY_DIV_CSS }>
                <form>
                    <table>
                    <label class="text-white text-xl"><span>{ "SANGAM 2.0" }</span></label>
                    {
                        members.iter().map(|m| {
                            html!{
                                <tr class="text-sm border">
                                    <td class="">{ m.clone() }</td>
                                </tr>
                            }
                        }).collect::<Html>()
                    }
                    </table>
                </form>
            </div>
        </BlankPage>
    }
}
