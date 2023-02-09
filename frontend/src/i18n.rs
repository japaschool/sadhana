use chrono::NaiveDate;
use i18n_codegen::i18n;
use once_cell::sync::Lazy;

i18n!("i18n");

static LANG: Lazy<String> = Lazy::new(|| {
    web_sys::window()
        .and_then(|w| w.navigator().language())
        .and_then(|l| l.split("_").next().map(|x| x.to_owned()))
        .unwrap_or("en".to_string())
});

impl Locale {
    pub fn current() -> Self {
        match LANG.as_str() {
            "ru" => Locale::Ru,
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
