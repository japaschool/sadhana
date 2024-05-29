use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::{css::*, i18n::Locale};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub title: AttrValue,
    #[prop_or_default]
    pub description: AttrValue,
    #[prop_or_default]
    pub onsuccess: Callback<String>,
    #[prop_or_default]
    pub oncancel: Callback<MouseEvent>,
}

#[function_component(Prompt)]
pub fn prompt(props: &Props) -> Html {
    let input_value = use_state(String::default);

    let submit = {
        let value = input_value.clone();
        let cb = props.onsuccess.clone();
        Callback::from(move |_| cb.emit((*value).clone()))
    };

    let oninput = {
        let value = input_value.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            value.set(input.value());
        })
    };

    html! {
        <div class="fixed top-0 w-full h-screen z-20">
            <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity overflow-hidden" />
            <div class="fixed inset-0 w-screen overflow-y-auto">
                <div class="flex min-h-screen justify-center p-4 text-center items-center sm:p-0">
                    <div class={format!("relative transform overflow-hidden rounded-lg text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg {}", POPUP_BG_CSS)}>
                        <div class="px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                        <div class="sm:flex sm:items-start dark:text-zinc-100 text-zinc-500">
                            <div class="text-center sm:ml-4 sm:mt-0 sm:text-left">
                            <h3 class="text-base font-semibold leading-6">{props.title.to_string()}</h3>
                            <div class="my-2">
                                <p class="text-sm">{props.description.to_string()}</p>
                            </div>
                            <input
                                autocomplete="off"
                                autofocus=true
                                id={"input"}
                                type="number"
                                value={(*input_value).clone()}
                                {oninput}
                                class={ format!("{} text-center", INPUT_CSS) }
                                />
                            </div>
                        </div>
                        </div>
                        <div class="px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                            <button class={format!("inline-flex w-full justify-center px-3 py-2 sm:ml-3 sm:w-auto {}", BTN_CSS_NO_MARGIN)} onclick={props.oncancel.clone()}>
                            <i class=""></i>{Locale::current().cancel()}</button>
                            <button class={format!("inline-flex w-full justify-center px-3 py-2 sm:mt-0 sm:w-auto {}", SUBMIT_BTN_CSS_NO_MARGIN)} onclick={submit}>
                            <i class=""></i>{Locale::current().save()}</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    }
}
