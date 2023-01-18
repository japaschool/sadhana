use yew::prelude::*;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub header_label: Option<String>,
    pub children: Children,
}

#[function_component(BlankPage)]
pub fn blank_page(props: &Props) -> Html {
    html! {
        <div class="bg-hero bg-no-repeat bg-cover bg-center min-h-screen justify-center py-6 sm:py-12">
            <div class="w-full text-center relative">
                <img class="h-20 inline-block" src="/logo.png" />
            </div>
            <div class="relative py-3 sm:max-w-xl sm:mx-auto">
                <div class="relative px-4 py-4 sm:rounded-3xl sm:p-20">
                    { props.header_label.iter().map(|l| {
                        html! {
                            <div class="pb-5">
                                <h1 class="text-2xl text-white">{ l }</h1>
                            </div>
                        }}).collect::<Html>()
                    }
                    { props.children.clone() }
                </div>
            </div>
        </div>
    }
}
