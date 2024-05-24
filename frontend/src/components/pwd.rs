use crate::{css::*, i18n::Locale};
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::use_bool_toggle;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub onchange: Callback<String>,
    #[prop_or(false)]
    pub readonly: bool,
    #[prop_or(true)]
    pub required: bool,
}

#[function_component(Pwd)]
pub fn pwd(props: &Props) -> Html {
    let new_pwd = use_state(String::default);
    let confirm_pwd = use_state(String::default);
    let show_pwd = use_bool_toggle(false);
    let confirm_pwd_html = use_mut_ref(|| None);

    let onfocus = {
        let confirm_pwd_html = confirm_pwd_html.clone();
        Callback::from(move |e: FocusEvent| {
            let target: HtmlInputElement = e.target_unchecked_into();
            if confirm_pwd_html.borrow().is_none() {
                *confirm_pwd_html.borrow_mut() = Some(target);
            }
        })
    };

    let oninput =
        |input_pwd: UseStateHandle<String>, confirm_pwd: UseStateHandle<String>, emit: bool| {
            let confirm_pwd_html = confirm_pwd_html.clone();
            let onchange = props.onchange.clone();
            Callback::from(move |e: InputEvent| {
                let target: HtmlInputElement = e.target_unchecked_into();

                input_pwd.set(target.value());

                let validity = if target.value() == *confirm_pwd {
                    String::default()
                } else {
                    Locale::current().passwords_dont_match()
                };

                confirm_pwd_html
                    .borrow()
                    .iter()
                    .for_each(|html| html.set_custom_validity(&validity));

                if emit {
                    onchange.emit(target.value());
                }
            })
        };

    let new_pwd_oninput = oninput(new_pwd.clone(), confirm_pwd.clone(), true);
    let confirm_pwd_oninput = oninput(confirm_pwd.clone(), new_pwd.clone(), false);

    let toggle_show_pwd_onclick = {
        let show_pwd = show_pwd.clone();
        Callback::from(move |_| {
            show_pwd.toggle();
        })
    };

    html! {
        <>
            <div class="relative">
                <input
                    id="new_pwd"
                    type={if *show_pwd {"text"} else {"password"}}
                    placeholder="New Password"
                    class={ INPUT_CSS }
                    value={ (*new_pwd).clone() }
                    oninput={ new_pwd_oninput }
                    required={ props.required }
                    autocomplete="off"
                    minlength="5"
                    maxlength="256"
                    readonly={ props.readonly }
                    />
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                    <i class={if *show_pwd {"icon-eye-cross"} else {"icon-eye"}} onclick={toggle_show_pwd_onclick.clone()} />
                </div>
                <label for="new_pwd"
                    class={ INPUT_LABEL_CSS }>
                    <i class="icon-key"></i>{ format!(" {}", Locale::current().new_password()) }
                </label>
            </div>
            <div class="relative">
                <input
                    id="confirm_pwd"
                    type={if *show_pwd {"text"} else {"password"}}
                    placeholder="Confirm Password"
                    class={ INPUT_CSS }
                    oninput={ confirm_pwd_oninput }
                    { onfocus }
                    value={ (*confirm_pwd).clone() }
                    required={ props.required }
                    autocomplete="off"
                    minlength="5"
                    maxlength="256"
                    readonly={ props.readonly }
                    />
                <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                    <i class={if *show_pwd {"icon-eye-cross"} else {"icon-eye"}} onclick={toggle_show_pwd_onclick.clone()} />
                </div>
                <label for="confirm_pwd"
                    class={ INPUT_LABEL_CSS }>
                    <i class="icon-key"></i>{ format!(" {}", Locale::current().confirm_password()) }
                </label>
            </div>
        </>
    }
}
