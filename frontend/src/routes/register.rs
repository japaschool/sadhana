use yew::prelude::*;

#[function_component(Register)]
pub fn register() -> Html {
    html! {<h1>{"Registration Page"}</h1>}
}

// pub enum Msg {
//     RegisterUser,
//     UpdateNameInputText(String),
//     UpdateEmailInputText(String),
//     UpdatePwdInputText(String),
//     // UpdateColorInputText(String),
//     // RegisterUserResponse(Result<User, rest_helper::RestError>),
//     // FindGameResponse(Result<String, rest_helper::RestError>),
//     // JoinGameResponse(Result<String, rest_helper::RestError>),
//     // NewGameResponse(Result<String, rest_helper::RestError>),
// }

// #[allow(dead_code)] //FIXME:
// pub struct Register {
//     user: Option<User>,
//     // router: RouteAgentDispatcher,
//     // storage: StorageService,
// }
// impl Component for Register {
//     type Message = Msg;
//     type Properties = ();

//     fn create(_ctx: &Context<Self>) -> Self {
//         Self { user: None }
//     }

//     fn update(&mut self, _ctx: &Context<Self>, _msg: Self::Message) -> bool {
//         false
//         // match msg {
//         //     Msg::SetInputEnabled(enabled) => {
//         //         if self.input_enabled != enabled {
//         //             self.input_enabled = enabled;
//         //             true // Re-render
//         //         } else {
//         //             false
//         //         }
//         //     }
//         // }
//     }

//     fn view(&self, ctx: &Context<Self>) -> Html {
//         let link = ctx.link();

//         html! {
//             <div>
//                 <h1>{ "New Sadhaka Registration" }</h1>
//                 <div>
//                     <label for="user_name">{"Devotee's Name:"}</label>
//                     <input type="text" oninput={link.callback(|e: InputEvent| Msg::UpdateNameInputText(e.data().unwrap_or("".to_string())))} />
//                     <label for="email_address">{"Email Address:"}</label>
//                     <input type="text" oninput={link.callback(|e: InputEvent| Msg::UpdateEmailInputText(e.value))} />
//                     <label for="user_name">{"Password:"}</label>
//                     <input type="text" oninput={link.callback(|e: InputEvent| Msg::UpdatePwdInputText(e.value))} />
//                     <button onclick={link.callback(|_| Msg::RegisterUser)}>
//                         { "Submit" }
//                     </button>
//                 </div>
//             </div>
//         }
//     }
// }
