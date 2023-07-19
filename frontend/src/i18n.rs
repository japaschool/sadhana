use chrono::NaiveDate;
use gloo::storage::{LocalStorage, Storage};
use i18n_codegen::i18n;
use once_cell::sync::Lazy;

i18n!("i18n");

pub const USER_LANGUAGE_STORAGE_KEY: &'static str = "user_language";
pub const DEFAULT_LANGUAGE_KEY: &'static str = "sys";

static LANG: Lazy<String> = Lazy::new(|| {
    web_sys::window()
        .and_then(|w| w.navigator().language())
        .and_then(|l| l.split("_").next().map(|x| x.to_owned()))
        .unwrap_or("ru".to_string())
});

impl Locale {
    pub fn current() -> Self {
        match LocalStorage::get::<String>(USER_LANGUAGE_STORAGE_KEY)
            .ok()
            .as_ref()
            .filter(|&v| v != DEFAULT_LANGUAGE_KEY)
            .map(|s| s.as_str())
            .unwrap_or(LANG.as_str())
        {
            "ru" => Locale::Ru,
            "ua" => Locale::Ua,
            _ => Locale::En,
        }
    }

    pub fn day_of_week(&self, dt: &NaiveDate) -> String {
        match dt.format("%a").to_string().as_str() {
            "Mon" => self.mon(),
            "Tue" => self.tue(),
            "Wed" => self.wed(),
            "Thu" => self.thu(),
            "Fri" => self.fri(),
            "Sat" => self.sat(),
            "Sun" => self.sun(),
            _ => unreachable!(),
        }
    }
}
