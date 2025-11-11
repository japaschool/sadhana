use std::{fmt::Display, str::FromStr};

use chrono::NaiveDate;
use gloo::storage::{LocalStorage, Storage};
use i18n_codegen::i18n;
use lazy_static::lazy_static;
use once_cell::sync::Lazy;

i18n!("i18n");

pub const USER_LANGUAGE_STORAGE_KEY: &str = "user_language";
pub const DEFAULT_LANGUAGE_KEY: &str = "sys";

lazy_static! {
    pub static ref DAYS: Vec<String> = vec![
        Locale::current().mon(),
        Locale::current().tue(),
        Locale::current().wed(),
        Locale::current().thu(),
        Locale::current().fri(),
        Locale::current().sat(),
        Locale::current().sun(),
    ];
}

pub static LANGUAGE_DATA: [(&str, &str); 3] =
    [("en", "English"), ("ru", "Русский"), ("uk", "Українська")];

static LANG: Lazy<String> = Lazy::new(|| {
    web_sys::window()
        .and_then(|w| {
            w.navigator().language().or_else(|| {
                w.navigator()
                    .languages()
                    .iter()
                    .next()
                    .and_then(|x| x.as_string())
            })
        })
        .and_then(|l| l.split('_').next().map(|x| x.to_owned()))
        .unwrap_or("ru".to_string())
});

impl Locale {
    pub fn current() -> Self {
        match LocalStorage::get::<String>(USER_LANGUAGE_STORAGE_KEY)
            .ok()
            .as_ref()
            .filter(|&v| v != DEFAULT_LANGUAGE_KEY)
            .map(|s| s.as_str())
            .unwrap_or(&LANG.as_str()[..2])
        {
            "ru" => Locale::Ru,
            "uk" => Locale::Ua,
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

    pub fn month_name(&self, month_num: u32) -> String {
        match month_num {
            1 => self.january(),
            2 => self.february(),
            3 => self.march(),
            4 => self.april(),
            5 => self.may(),
            6 => self.june(),
            7 => self.july(),
            8 => self.august(),
            9 => self.september(),
            10 => self.october(),
            11 => self.november(),
            12 => self.december(),
            _ => unreachable!(),
        }
    }

    pub fn chrono(&self) -> chrono::Locale {
        let default = || match self {
            Locale::Ua => chrono::Locale::uk_UA,
            Locale::Ru => chrono::Locale::ru_RU,
            Locale::En => chrono::Locale::en_IE,
        };
        if LANG.as_str()[..2] == self.to_string() {
            chrono::Locale::from_str(LANG.as_str())
                .ok()
                .unwrap_or_else(default)
        } else {
            default()
        }
    }

    pub fn about_url(&self) -> String {
        format!("https://sadhana.pro/{}", self)
    }
}

impl Display for Locale {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Locale::Ua => "uk",
            Locale::Ru => "ru",
            _ => "en",
        };

        write!(f, "{}", s)
    }
}
