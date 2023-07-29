use common::error::AppError;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::prelude::*;
use yew_router::prelude::*;

use crate::{
    components::{blank_page::BlankPage, list_errors::ListErrors},
    css::*,
    hooks::use_user_context,
    i18n::*,
    model::*,
    services, BaseRoute,
};

#[function_component(EditUser)]
pub fn edit_user() -> Html {
    html! {
              <BlankPage show_footer=true >
        <div class={ BODY_DIV_CSS }>
        <div class="text-center">
        <img
        src="https://tecdn.b-cdn.net/img/new/avatars/2.webp"
        class="mx-auto mb-4 w-32 rounded-full"
        alt="Avatar" />
      <h5 class="mb-4 text-xl font-medium leading-tight">{"Name Surname"}</h5>
      <p class="text-zinc-500 dark:text-zinc-200">{"email"}</p>
      <p class="text-zinc-500 dark:text-zinc-200">{"Some other info"}</p>
    </div>
        </div>
              </BlankPage>
            }
}
