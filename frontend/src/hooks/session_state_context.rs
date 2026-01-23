use chrono::{Local, NaiveDate};
use std::rc::Rc;
use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct SessionState {
    pub selected_date: NaiveDate,
    pub today: NaiveDate,
}

pub enum SessionAction {
    UpdateToday,
    SetSelected(NaiveDate),
}

impl Reducible for SessionState {
    type Action = SessionAction;

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        match action {
            SessionAction::UpdateToday => {
                let today = Local::now().date_naive();
                if today == self.today {
                    self
                } else {
                    Self {
                        selected_date: self.selected_date,
                        today,
                    }
                    .into()
                }
            }
            SessionAction::SetSelected(selected_date) => Self {
                today: self.today,
                selected_date,
            }
            .into(),
        }
    }
}

pub type Session = UseReducerHandle<SessionState>;

impl SessionState {
    pub fn today_selected(&self) -> bool {
        self.today == self.selected_date
    }
}

#[derive(Properties, Debug, PartialEq)]
pub struct SessionStateProviderProps {
    #[prop_or_default]
    pub children: Html,
}

#[function_component]
pub fn SessionStateProvider(props: &SessionStateProviderProps) -> Html {
    let init = Local::now().date_naive();
    let state = use_reducer(|| SessionState {
        selected_date: init,
        today: init,
    });

    html! {
        <ContextProvider<Session> context={state}>
            { props.children.clone() }
        </ContextProvider<Session>>
    }
}
