use std::ops::Deref;

use yew::prelude::*;
use yew_router::prelude::*;

use crate::model::UserInfo;

pub struct UseUserContextHandle {
    inner: UseStateHandle<UserInfo>,
    history: AnyHistory,
}

impl UseUserContextHandle {
    pub fn redirect_to<T: Routable>(&self, route: T) {
        self.history.push(route);
    }
}

impl Deref for UseUserContextHandle {
    type Target = UserInfo;

    fn deref(&self) -> &Self::Target {
        &(*self.inner)
    }
}

pub fn use_user_context() -> UseUserContextHandle {
    let inner = use_context::<UseStateHandle<UserInfo>>().unwrap();
    let history = use_history().unwrap();

    UseUserContextHandle { inner, history }
}
