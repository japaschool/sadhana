use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub label: AttrValue,
    pub tab_index: u8,
    pub children: Children,
}

#[function_component(SummaryDetails)]
pub fn summary_details(props: &Props) -> Html {
    html! {
        <div class="group" tabindex={props.tab_index.to_string()}>
            <div class="group flex justify-between px-4 py-2 items-center transition cursor-pointer pr-10 relative">
                <div class="items-center inline-flex justify-center rotate-180 transform transition group-focus:-rotate-90 absolute left-0 mb-auto ml-auto">
                    <i class="icon-chevron-left"></i>
                </div>
                <div class="transition pl-4 hover:opacity-50">{props.label.to_string()}</div>
            </div>
            <div class="group-focus:max-h-screen focus-within:max-h-screen max-h-0 px-4 overflow-hidden">
                {props.children.clone()}
            </div>
        </div>
    }
}
