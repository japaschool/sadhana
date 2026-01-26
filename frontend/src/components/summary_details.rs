use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub label: AttrValue,
    pub children: Children,
    #[prop_or(false)]
    pub open: bool,
}

#[function_component(SummaryDetails)]
pub fn summary_details(props: &Props) -> Html {
    html! {
        <details class="group" open={props.open}>
            <summary
                class="group flex justify-between px-4 py-2 items-center transition cursor-pointer pr-10 relative"
            >
                <div
                    class="items-center inline-flex justify-center rotate-180 transform transition
                        absolute left-0 mb-auto ml-auto"
                >
                    <i class="icon-chevron-left" />
                </div>
                <p class="transition can-hover:hover:opacity-50 pl-4 text-left">
                    { props.label.to_string() }
                </p>
            </summary>
            <div
                class="group-open:max-h-screen focus-within:max-h-screen
                    max-h-0 overflow-hidden"
            >
                { props.children.clone() }
            </div>
        </details>
    }
}
