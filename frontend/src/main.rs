use yew::prelude::*;
use yew_router::prelude::*;

use crate::components::use_context_provider::UserContextProvider;
use crate::routes::*;

mod components;
mod hooks;
mod model;
mod routes;

#[function_component(App)]
fn app() -> Html {
    html! {
        <UserContextProvider>
            <BrowserRouter>
                <Switch<AppRoute> render={Switch::render(switch)} />
            </BrowserRouter>
        </UserContextProvider>
    }
}

fn main() {
    wasm_logger::init(wasm_logger::Config::new(log::Level::Trace));
    console_error_panic_hook::set_once();
    yew::start_app::<App>();
}
