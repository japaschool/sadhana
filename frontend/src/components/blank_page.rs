use yew::prelude::*;
use yew_router::prelude::*;

use crate::{css::*, routes::AppRoute};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub header_label: Option<String>,
    #[prop_or_default]
    pub prev_link: Option<(String, AppRoute)>,
    #[prop_or(false)]
    pub loading: bool,
    pub children: Children,
}

#[function_component(BlankPage)]
pub fn blank_page(props: &Props) -> Html {
    html! {
        <div class="bg-hero bg-no-repeat bg-cover bg-center min-h-screen justify-center py-6 sm:py-12">
            if props.loading {
                <div class="bg-gray-500 bg-opacity-50 absolute left-0 top-0 z-50 h-full w-full overflow-hidden flex">
                    <div class="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-10 w-10 m-auto">
                    </div>
                </div>
            }
            <div class="w-full text-center relative">
                { props.prev_link.iter().map(|(label, route)|
                    html! {
                        <div class="absolute flex w-full h-full flex-col justify-center px-4">
                            <div class="relative">
                                <div class="relative sm:max-w-xl sm:mx-auto">
                                    <div class="relative flex py-10 sm:p-20">
                                        <span class="text-white"><i class="fa-solid fa-chevron-left"></i>
                                            <Link<AppRoute> classes={ LINK_CSS } to={ route.clone() }>
                                                { format!(" {}", label) }
                                            </Link<AppRoute>>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }).collect::<Html>()
                }
                <img class="h-20 inline-block" src="/images/logo.png" />
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
