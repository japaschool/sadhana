// Fix for now: https://github.com/rustwasm/wasm-bindgen/issues/2774
// #![allow(clippy::unused_unit)]

use yew::prelude::*;
use yew_router::prelude::*;

use crate::routes::*;

mod components;
mod css;
mod hooks;
mod i18n;
mod model;
mod routes;
mod services;
mod web_sys_ext;

#[function_component(App)]
fn app() -> Html {
    html! {
        <BrowserRouter>
        <Switch<BaseRoute> render={switch} />
        </BrowserRouter>
    }
}

fn main() {
    wasm_logger::init(wasm_logger::Config::new(log::Level::Debug));
    console_error_panic_hook::set_once();
    yew::Renderer::<App>::new().render();
}
