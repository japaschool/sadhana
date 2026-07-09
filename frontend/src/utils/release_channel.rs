use wasm_bindgen::JsCast;
use web_sys::{HtmlDocument, window};

const COOKIE_NAME: &str = "sadhana_release_channel";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReleaseChannel {
    Stable,
    Preview,
}

impl ReleaseChannel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Preview => "preview",
        }
    }
}

pub fn current_release_channel() -> ReleaseChannel {
    let Some(document) = window()
        .and_then(|w| w.document())
        .and_then(|d| d.dyn_into::<HtmlDocument>().ok())
    else {
        return ReleaseChannel::Stable;
    };
    let Ok(cookie) = document.cookie() else {
        return ReleaseChannel::Stable;
    };

    parse_release_channel_cookie(&cookie)
}

pub fn set_release_channel(channel: ReleaseChannel) {
    if let Some(document) = window()
        .and_then(|w| w.document())
        .and_then(|d| d.dyn_into::<HtmlDocument>().ok())
    {
        let cookie = format!(
            "{}={}; Path=/; Secure; SameSite=Lax; Max-Age=2592000",
            COOKIE_NAME,
            channel.as_str()
        );
        let _ = document.set_cookie(&cookie);
    }
}

pub fn toggle_release_channel() -> ReleaseChannel {
    let next = match current_release_channel() {
        ReleaseChannel::Stable => ReleaseChannel::Preview,
        ReleaseChannel::Preview => ReleaseChannel::Stable,
    };
    set_release_channel(next);
    next
}

fn parse_release_channel_cookie(cookie: &str) -> ReleaseChannel {
    for pair in cookie.split(';').map(str::trim) {
        let Some((name, value)) = pair.split_once('=') else {
            continue;
        };
        if name == COOKIE_NAME {
            return if value == ReleaseChannel::Preview.as_str() {
                ReleaseChannel::Preview
            } else {
                ReleaseChannel::Stable
            };
        }
    }

    ReleaseChannel::Stable
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_preview_cookie() {
        let parsed = parse_release_channel_cookie("foo=bar; sadhana_release_channel=preview");
        assert_eq!(parsed, ReleaseChannel::Preview);
    }

    #[test]
    fn defaults_to_stable_on_missing_cookie() {
        let parsed = parse_release_channel_cookie("foo=bar");
        assert_eq!(parsed, ReleaseChannel::Stable);
    }
}
