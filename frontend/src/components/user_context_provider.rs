use yew::prelude::*;
use yew_hooks::prelude::*;

use crate::{
    error::Error,
    model::UserInfo,
    services::{
        current,
        requests::{get_token, set_token},
    },
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub children: Children,
}

#[function_component(UserContextProvider)]
pub fn user_context_provider(props: &Props) -> Html {
    let user_ctx = use_state(UserInfo::default);
    let current_user = use_async(async move { current().await });

    {
        /* On startup check if the user is already loggd in from local storage. */
        let current_user = current_user.clone();
        use_mount(move || {
            log::debug!("Running startup check for token in local storage.");
            if get_token().is_some() {
                log::debug!("Found token. Fetching current user.");
                current_user.run();
            }
        });
    }

    {
        /* If local storage has a token either log the user in or show error if couldn't fetch user data. */
        let user_ctx = user_ctx.clone();
        use_effect_with_deps(
            move |current_user| {
                log::debug!("Detected a change in current user. Checking its token.");
                if let Some(user_info) = &current_user.data {
                    log::debug!(
                        "Updating the state with current user info {:?}.",
                        user_info.user
                    );
                    user_ctx.set(user_info.user.clone());
                }

                if let Some(error) = &current_user.error {
                    log::debug!(
                        "Found an error in current user state. Possibly ressetting stored token."
                    );
                    match error {
                        Error::Unauthorized | Error::Forbidden => set_token(None),
                        _ => (),
                    }
                }
                || ()
            },
            current_user,
        )
    }

    html! {
        <ContextProvider<UseStateHandle<UserInfo>> context={user_ctx}>
            { for props.children.iter() }
        </ContextProvider<UseStateHandle<UserInfo>>>
    }
}
