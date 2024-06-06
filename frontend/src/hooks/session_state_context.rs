use chrono::{Local, NaiveDate};
use std::rc::Rc;
use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SessionState {
    pub selected_date: NaiveDate,
}

impl Reducible for SessionState {
    type Action = NaiveDate;

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        SessionState {
            selected_date: action,
        }
        .into()
    }
}

pub type SessionStateContext = UseReducerHandle<SessionState>;

#[derive(Properties, Debug, PartialEq)]
pub struct SessionStateProviderProps {
    #[prop_or_default]
    pub children: Html,
}

#[function_component]
pub fn SessionStateProvider(props: &SessionStateProviderProps) -> Html {
    let state = use_reducer(|| SessionState {
        selected_date: Local::now().date_naive(),
    });

    html! {
        <ContextProvider<SessionStateContext> context={state}>
            {props.children.clone()}
        </ContextProvider<SessionStateContext>>
    }
}
