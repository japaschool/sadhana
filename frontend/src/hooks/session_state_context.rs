use chrono::{Local, NaiveDate, NaiveTime};
use std::rc::Rc;
use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SessionState {
    pub selected_date: NaiveDate,
    // A field to trigger refresh of components that depend on session state, eg calendar
    pub last_updated: NaiveTime,
}

impl Reducible for SessionState {
    type Action = NaiveDate;

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        SessionState {
            selected_date: action,
            last_updated: Local::now().time(),
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
        last_updated: Local::now().time(),
    });

    html! {
        <ContextProvider<SessionStateContext> context={state}>
            {props.children.clone()}
        </ContextProvider<SessionStateContext>>
    }
}
