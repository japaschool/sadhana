use crate::model::User;
use yew::prelude::*;

pub enum Msg {
    _RegisterUser,
    // UpdateNameInputText(String),
    // UpdateColorInputText(String),
    // RegisterUserResponse(Result<User, rest_helper::RestError>),
    // FindGameResponse(Result<String, rest_helper::RestError>),
    // JoinGameResponse(Result<String, rest_helper::RestError>),
    // NewGameResponse(Result<String, rest_helper::RestError>),
}

#[allow(dead_code)] //FIXME:
pub struct Register {
    user: Option<User>,
    // router: RouteAgentDispatcher,
    // storage: StorageService,
}
impl Component for Register {
    type Message = Msg;
    type Properties = ();

    fn create(_ctx: &Context<Self>) -> Self {
        Self { user: None }
    }

    fn update(&mut self, _ctx: &Context<Self>, _msg: Self::Message) -> bool {
        false
        // match msg {
        //     Msg::SetInputEnabled(enabled) => {
        //         if self.input_enabled != enabled {
        //             self.input_enabled = enabled;
        //             true // Re-render
        //         } else {
        //             false
        //         }
        //     }
        // }
    }

    fn view(&self, _ctx: &Context<Self>) -> Html {
        html! {
            <h1>{ "Registeration" }</h1>
        }
    }
}
