// Fix for now: https://github.com/rustwasm/wasm-bindgen/issues/2774
// #![allow(clippy::unused_unit)]

use yew::prelude::*;
use yew_router::prelude::*;

use crate::routes::*;
use components::user_context_provider::UserContextProvider;
use hooks::{AppUpdateProvider, NetworkStatusProvider, SessionStateProvider};

mod components;
mod css;
mod hooks;
mod i18n;
mod model;
mod routes;
mod services;
mod utils;
mod web_sys_ext;

#[function_component(App)]
fn app() -> Html {
    html! {
        <BrowserRouter>
            <UserContextProvider>
                <NetworkStatusProvider>
                    <AppUpdateProvider>
                        <SessionStateProvider>
                            <Switch<BaseRoute> render={switch} />
                        </SessionStateProvider>
                    </AppUpdateProvider>
                </NetworkStatusProvider>
            </UserContextProvider>
        </BrowserRouter>
    }
}

fn main() {
    wasm_logger::init(wasm_logger::Config::new(log::Level::Debug));
    console_error_panic_hook::set_once();
    yew::Renderer::<App>::new().render();
}
