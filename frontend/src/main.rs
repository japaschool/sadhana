// Fix for now: https://github.com/rustwasm/wasm-bindgen/issues/2774
// #![allow(clippy::unused_unit)]

use yew::prelude::*;
use yew_router::prelude::*;

use crate::components::user_context_provider::UserContextProvider;
use crate::routes::*;

mod components;
mod error;
mod hooks;
mod model;
mod routes;
mod services;

#[function_component(App)]
fn app() -> Html {
    html! {
        <BrowserRouter>
            <UserContextProvider>
                <Switch<AppRoute> render={Switch::render(switch)} />
            </UserContextProvider>
        </BrowserRouter>
    }
}

fn main() {
    wasm_logger::init(wasm_logger::Config::new(log::Level::Debug));
    console_error_panic_hook::set_once();
    yew::start_app::<App>();
}
