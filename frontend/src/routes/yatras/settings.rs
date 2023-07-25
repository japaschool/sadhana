use yew::prelude::*;
use yew_hooks::use_async;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    i18n::Locale,
    model::UserPractice,
};

#[derive(Properties, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
}

// TODO: add leave yatra button

#[function_component(YatraSettings)]
pub fn yatra_settings(props: &Props) -> Html {
    // let yatra_practices = use_async(async move {

    // });
    let yatra_practices = vec![
        ((1, "Wake Up Time".to_string()), Some((2, "Wake up"))),
        ((2, "Rounds".to_string()), None),
    ];

    html! {
        <BlankPage>
            <form>
                <div class={ BODY_DIV_CSS }>
                    <div class="relative">
                        <label class="text-gray-600">{ "Choose your personal practices from the dropdowns to match the yatra practices. Leave blank to skip." }</label>
                    </div>
                    <div class="relative">
                        <select
                            class={ INPUT_CSS }
                            // id="yatra"
                            // onchange={ yatra_onchange }
                            // required=true
                            >
                                <option class="text-black" selected=true >{ "Skip" }</option>
                                <option class="text-black" >{ "Wake Up" }</option>
                                <option class="text-black" >{ "Night Time" }</option>
                        </select>
                        <label for="yatra" class={ INPUT_LABEL_CSS }>
                            <i class="icon-user-group"></i>
                            { format!(" {}: ", "Wake Up Time") }
                        </label>
                    </div>
                    <div class="relative">
                        <select
                            class={ INPUT_CSS }
                            // id="yatra"
                            // onchange={ yatra_onchange }
                            // required=true
                            >
                                <option class="text-black" selected=true >{ "Skip" }</option>
                                <option class="text-black" >{ "Total Rounds" }</option>
                                <option class="text-black" >{ "Morning Rounds" }</option>
                        </select>
                        <label for="yatra" class={ INPUT_LABEL_CSS }>
                            <i class="icon-user-group"></i>
                            { format!(" {}: ", "Rounds") }
                        </label>
                    </div>
                    <div class="relative">
                        <button class={ BTN_CSS }>
                            <i class="icon-tick"></i>{ format!(" {}", "Leave") }
                        </button>
                        <button class={ SUBMIT_BTN_CSS }>
                            <i class="icon-tick"></i>{ format!(" {}", "Save") }
                        </button>
                    </div>
                </div>
            </form>
        </BlankPage>
    }
}
