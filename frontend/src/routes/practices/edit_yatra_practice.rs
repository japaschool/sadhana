use strum::{Display, EnumString, IntoEnumIterator};
use tw_merge::*;
use web_sys::HtmlInputElement;
use yew::prelude::*;
use yew_hooks::{use_async, use_bool_toggle, use_mount};
use yew_router::prelude::use_navigator;

use crate::{
    components::{
        blank_page::{BlankPage, HeaderButtonProps},
        grid::{Grid, ZoneColour},
        list_errors::ListErrors,
        summary_details::SummaryDetails,
    },
    css::*,
    i18n::*,
    model::{PracticeDataType, PracticeEntryValue, YatraPractice},
    services::{get_yatra_practice, update_yatra_practice},
    utils::time_dur_input_support::*,
    AppRoute,
};

const COLOUR_ZONE_DATA_TYPES: [PracticeDataType; 3] = [
    PracticeDataType::Time,
    PracticeDataType::Duration,
    PracticeDataType::Int,
];

#[derive(Clone, Debug, PartialEq)]
pub struct ColourZonesConfig {
    pub better_direction: BetterDirection,
    pub bounds: Vec<Bound>,
    pub no_value_colour: ZoneColour,
}

impl Default for ColourZonesConfig {
    fn default() -> Self {
        Self {
            better_direction: BetterDirection::Higher,
            bounds: vec![Bound::default_yellow(), Bound::default_green()],
            no_value_colour: ZoneColour::Neutral,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Display, EnumString)]
pub enum BetterDirection {
    Higher,
    Lower,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Bound {
    pub to: Option<PracticeEntryValue>,
    pub colour: ZoneColour,
}

impl Default for Bound {
    fn default() -> Self {
        Self {
            to: None,
            colour: ZoneColour::Neutral,
        }
    }
}

impl Bound {
    pub fn default_red() -> Self {
        Self {
            colour: ZoneColour::Red,
            ..Default::default()
        }
    }
    pub fn default_green() -> Self {
        Self {
            colour: ZoneColour::Green,
            ..Default::default()
        }
    }
    pub fn default_yellow() -> Self {
        Self {
            colour: ZoneColour::Yellow,
            ..Default::default()
        }
    }
}

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub yatra_id: AttrValue,
    pub practice_id: AttrValue,
}

#[function_component(EditYatraPractice)]
pub fn edit_yatra_practice(props: &Props) -> Html {
    let nav = use_navigator().unwrap();
    let practice = use_state(YatraPractice::default);
    let color_zones_hidden = use_bool_toggle(true);
    let color_zones_enabled = use_bool_toggle(false);
    let colour_zones_config = use_state(ColourZonesConfig::default);
    // use_mut_ref is to avoid re-rendering on every key press
    let backspace_key_pressed = use_mut_ref(|| false);

    //-------------------------------------------------------------------------

    let current_practice = {
        let practice_id = props.practice_id.clone();
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            get_yatra_practice(&yatra_id, &practice_id)
                .await
                .map(|res| res.practice)
        })
    };

    let update_practice = {
        let practice = practice.clone();
        let nav = nav.clone();
        let yatra_id = props.yatra_id.clone();
        use_async(async move {
            update_yatra_practice(&yatra_id, &practice)
                .await
                .map(|_| nav.back())
        })
    };

    //-------------------------------------------------------------------------

    {
        let current_practice = current_practice.clone();
        use_mount(move || {
            current_practice.run();
        });
    }

    {
        let practice = practice.clone();
        let color_zones_enabled = color_zones_hidden.clone();
        use_effect_with(current_practice.clone(), move |current| {
            current.data.iter().for_each(|p| {
                color_zones_enabled.set(!COLOUR_ZONE_DATA_TYPES.contains(&p.data_type));
                practice.set(p.to_owned())
            });
            || ()
        });
    }

    //-------------------------------------------------------------------------

    let num_zones_selected = |zones| colour_zones_config.bounds.len() == zones;

    fn is_bound_value_valid(bounds: &[Bound], colour: ZoneColour) -> bool {
        if let Some(idx) = bounds.iter().position(|b| b.colour == colour) {
            if idx == 0 {
                return true;
            }
            let cur_opt = bounds[idx].to.as_ref();
            let prev_opt = bounds[idx - 1].to.as_ref();
            if let (Some(cur), Some(prev)) = (cur_opt, prev_opt) {
                return cur > prev;
            }
        }
        true
    }

    fn find_zone(value: &PracticeEntryValue, bounds: &[Bound], fallback: ZoneColour) -> ZoneColour {
        for bound in bounds {
            let Some(to) = &bound.to else {
                continue; // ignore None
            };
            if value <= to {
                return bound.colour.clone();
            }
        }
        fallback
    }

    fn midpoint(a: &PracticeEntryValue, b: &PracticeEntryValue) -> Option<PracticeEntryValue> {
        match (a, b) {
            (PracticeEntryValue::Int(x), PracticeEntryValue::Int(y)) => {
                Some(PracticeEntryValue::Int((x + y) / 2))
            }
            (PracticeEntryValue::Duration(x), PracticeEntryValue::Duration(y)) => {
                Some(PracticeEntryValue::Duration((x + y) / 2))
            }
            (
                PracticeEntryValue::Time { h: h1, m: m1 },
                PracticeEntryValue::Time { h: h2, m: m2 },
            ) => {
                let t1 = (*h1 as u16) * 60 + (*m1 as u16);
                let t2 = (*h2 as u16) * 60 + (*m2 as u16);
                let mid = (t1 + t2) / 2;

                Some(PracticeEntryValue::Time {
                    h: (mid / 60) as u8,
                    m: (mid % 60) as u8,
                })
            }
            _ => None,
        }
    }

    fn just_above(v: &PracticeEntryValue) -> Option<PracticeEntryValue> {
        match v {
            PracticeEntryValue::Int(x) => Some(PracticeEntryValue::Int(x + 1)),
            PracticeEntryValue::Duration(x) => Some(PracticeEntryValue::Duration(x + 1)),
            PracticeEntryValue::Time { h, m } => {
                let t = (*h as u16) * 60 + (*m as u16) + 1;
                Some(PracticeEntryValue::Time {
                    h: (t / 60) as u8,
                    m: (t % 60) as u8,
                })
            }
            _ => None,
        }
    }

    fn preview_values(bounds: &[Bound]) -> Vec<PracticeEntryValue> {
        let mut out = Vec::new();

        // Find first concrete value to infer type
        let mut prev = match bounds.iter().flat_map(|b| b.to.iter()).next() {
            Some(PracticeEntryValue::Int(_)) => PracticeEntryValue::Int(0),
            Some(PracticeEntryValue::Duration(_)) => PracticeEntryValue::Duration(0),
            Some(PracticeEntryValue::Time { .. }) => PracticeEntryValue::Time { h: 0, m: 1 },
            _ => return vec![],
        };

        let mut saw_concrete_bound = false;

        for bound in bounds {
            let Some(to) = &bound.to else {
                // Ignore zones without `to`
                continue;
            };

            saw_concrete_bound = true;

            if let Some(v) = midpoint(&prev, to) {
                out.push(v);
            }

            prev = to.clone();
        }

        // Only add implicit final zone if there was at least one concrete bound
        if saw_concrete_bound {
            if let Some(v) = just_above(&prev) {
                out.push(v);
            }
        }

        out
    }

    let preview_heatmap_conf = {
        let colour_zones_config = colour_zones_config.clone();
        let cb = Callback::from(move |v| {
            find_zone(
                &v,
                &colour_zones_config.bounds,
                match colour_zones_config.better_direction {
                    BetterDirection::Higher => ZoneColour::Green,
                    BetterDirection::Lower => ZoneColour::Red,
                },
            )
        });
        Some(cb)
    };

    let preview_data = {
        vec![preview_values(&colour_zones_config.bounds)
            .into_iter()
            .map(Some)
            .collect::<Vec<_>>()]
    };

    //-------------------------------------------------------------------------

    let num_zones_onchange = {
        let colour_zones_config = colour_zones_config.clone();
        let color_zones_enabled = color_zones_enabled.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut config = ColourZonesConfig::default();
            let num_zones = input.value().parse::<usize>().unwrap_or(0);
            color_zones_enabled.set(num_zones > 0);
            let zones = match num_zones {
                3 => vec![Bound::default_red(), Bound::default_yellow()],
                2 => vec![Bound::default_red()],
                _ => vec![],
            };
            config.bounds = zones;
            log::debug!("config: {:?}", config);
            colour_zones_config.set(config);
        })
    };

    let better_when_onchange = {
        let colour_zones_config = colour_zones_config.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut config = (*colour_zones_config).clone();
            config.better_direction = input
                .value()
                .as_str()
                .parse()
                .unwrap_or(BetterDirection::Higher);
            if let Some(b) = config.bounds.first_mut() {
                b.colour = if config.better_direction == BetterDirection::Higher {
                    ZoneColour::Red
                } else {
                    ZoneColour::Green
                }
            };
            colour_zones_config.set(config);
        })
    };

    let no_value_onchange = {
        let colour_zones_config = colour_zones_config.clone();
        Callback::from(move |e: Event| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut config = (*colour_zones_config).clone();
            config.no_value_colour = input
                .value()
                .as_str()
                .parse()
                .unwrap_or(ZoneColour::Neutral);
            colour_zones_config.set(config);
        })
    };

    let onchange_bound_value = {
        let colour_zones_config = colour_zones_config.clone();
        let practice = practice.clone();
        move |mut input: HtmlInputElement| {
            match practice.data_type {
                PracticeDataType::Time => {
                    if input.value() == TIME_PATTERN {
                        input.set_value("");
                    }
                }
                PracticeDataType::Duration => format_duration(&mut input),
                _ => (),
            }

            let mut config: ColourZonesConfig = (*colour_zones_config).clone();
            let colour = input.id().as_str().parse().unwrap_or(ZoneColour::Neutral);
            // parse number safely
            let value =
                PracticeEntryValue::try_from((&practice.data_type, input.value().as_str())).ok();
            // set the bound value
            if let Some(bound) = config.bounds.iter_mut().find(|b| b.colour == colour) {
                bound.to = value;
            }

            if !is_bound_value_valid(&config.bounds, colour) {
                // TODO: i18n
                input.set_custom_validity("Must be greater than previous bound");
            } else {
                input.set_custom_validity("");
            }
            // update state and show validity UI
            colour_zones_config.set(config);
            let _ = input.report_validity();
        }
    };

    let onkeydown_time_dur = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: KeyboardEvent| {
            *back.borrow_mut() = e.key() == "Backspace";
        })
    };

    let practice_oninput = {
        let practice = practice.clone();
        Callback::from(move |e: InputEvent| {
            let input: HtmlInputElement = e.target_unchecked_into();
            let mut new_practice = (*practice).clone();
            new_practice.practice = input.value();
            practice.set(new_practice);
        })
    };

    let onsubmit = {
        let update_user_practice = update_practice.clone();
        Callback::from(move |e: SubmitEvent| {
            e.prevent_default();
            update_user_practice.run();
        })
    };

    //-------------------------------------------------------------------------

    html! {
        <form {onsubmit}>
            <BlankPage
                left_button={HeaderButtonProps::back_to(AppRoute::YatraAdminSettings { id: props.yatra_id.to_string() })}
                loading={update_practice.loading}
                header_label={Locale::current().practice()}
                >
                <ListErrors error={current_practice.error.clone()} />
                <ListErrors error={update_practice.error.clone()} />
                <div class={BODY_DIV_CSS}>
                    <div class="relative">
                        <input
                            id="practice"
                            type="text"
                            placeholder="Practice"
                            class={INPUT_CSS}
                            value={practice.practice.clone()}
                            oninput={practice_oninput}
                            required=true
                            />
                        <label for="practice"
                            class={INPUT_LABEL_CSS}>
                            <i class="icon-doc"></i>{format!(" {}", Locale::current().name())}
                        </label>
                    </div>
                    {if !*color_zones_hidden {
                        html! {
                            <SummaryDetails label={"Colour zones"}>
                                <div class="relative">
                                    // <label class="text-lg">{"Colour zones"}</label>
                                    <div class="pt-2">
                                        <p class="text-xs text-zinc-500 dark:text-zinc-200">{"TODO: [i18n] Colour zones make the yatra table more visual by painting each value cell red, green, or yellow depending on the cell value."}</p>
                                    </div>
                                </div>
                                <div class={BODY_DIV_CSS}>
                                <div class="relative">
                                    <select
                                        id="num_zones"
                                        onchange={num_zones_onchange}
                                        class={
                                            tw_merge!(
                                                "appearance-none",
                                                INPUT_CSS,
                                                "text-center [text-align-last:center] has-value")
                                        } >
                                        <option class={"text-black"} selected={num_zones_selected(0)} value={"0"}>{"Disabled"}</option>
                                        <option class={"text-black"} selected={num_zones_selected(2)} value={"3"}>{"3 (Red, Yellow, Green)"}</option>
                                        <option class={"text-black"} selected={num_zones_selected(1)} value={"2"}>{"2 (Red, Green)"}</option>
                                    </select>
                                    <label
                                        for="num_zones"
                                        class={INPUT_SELECT_LABEL_CSS}>
                                        <i class="icon-rounds"></i>{" Number of zones:"}
                                    </label>
                                </div>
                                <div class="relative">
                                    <select
                                        id="better_direction"
                                        disabled={!*color_zones_enabled}
                                        onchange={better_when_onchange}
                                        class={
                                            tw_merge!(
                                                "appearance-none text-center [text-align-last:center] has-value",
                                                INPUT_CSS)
                                        } >
                                        <option
                                            class={"text-black"}
                                            selected={colour_zones_config.better_direction == BetterDirection::Higher}
                                            value={BetterDirection::Higher.to_string()}
                                        >
                                            {BetterDirection::Higher.to_string()}
                                        </option>
                                        <option
                                            class={"text-black"}
                                            selected={colour_zones_config.better_direction == BetterDirection::Lower}
                                            value={BetterDirection::Lower.to_string()}
                                        >
                                            {BetterDirection::Lower.to_string()}
                                        </option>
                                    </select>
                                    <label
                                        for="better_direction"
                                        class={INPUT_SELECT_LABEL_CSS}>
                                        <i class="icon-rounds"></i>{" Better when:"}
                                    </label>
                                </div>
                                {for colour_zones_config.bounds.iter().map(|bound|
                                    match practice.data_type {
                                        PracticeDataType::Int => html! {
                                            <div class="relative">
                                                <input
                                                    id={bound.colour.to_string()}
                                                    type="number"
                                                    inputmode="numeric"
                                                    min="0"
                                                    max="174"
                                                    autocomplete="off"
                                                    placeholder={bound.colour.to_string()}
                                                    class={tw_merge!(INPUT_CSS, "text-center")}
                                                    value={
                                                        bound.to
                                                            .iter()
                                                            .find_map(|v| v.as_int().map(|i| i.to_string()))
                                                            .unwrap_or_default()
                                                    }
                                                    onchange={
                                                        let onchange = onchange_bound_value.clone();
                                                        Callback::from(move |e: Event| {
                                                            let input: HtmlInputElement = e.target_unchecked_into();
                                                            onchange(input)
                                                        })
                                                    }
                                                />
                                                <label
                                                    for={bound.colour.to_string()}
                                                    class={INPUT_LABEL_CSS}
                                                >
                                                    <i class="icon-rounds"/>
                                                    {format!("{:?} up to: ", bound.colour)} //TODO: i18n
                                                </label>
                                            </div>
                                        },
                                        PracticeDataType::Time => html! {
                                            <div class="relative">
                                                <input
                                                    id={bound.colour.to_string()}
                                                    autocomplete="off"
                                                    type="text"
                                                    inputmode="numeric"
                                                    placeholder={bound.colour.to_string()}
                                                    class={tw_merge!(INPUT_CSS, "text-center")}
                                                    onblur={
                                                        let onchange = onchange_bound_value.clone();
                                                        Callback::from(move |e: FocusEvent| {
                                                            let input: HtmlInputElement = e.target_unchecked_into();
                                                            onchange(input)
                                                        })
                                                    }
                                                    onfocus={
                                                        Callback::from(move |e: FocusEvent| {
                                                            let mut input: HtmlInputElement = e.target_unchecked_into();
                                                            format_time(&mut input, false);
                                                        })
                                                    }
                                                    oninput={
                                                        let back = backspace_key_pressed.clone();
                                                        Callback::from(move |e: InputEvent| {
                                                            let mut input: HtmlInputElement = e.target_unchecked_into();
                                                            format_time(&mut input, *back.borrow());
                                                        })
                                                    }
                                                    onkeydown={onkeydown_time_dur.clone()}
                                                    value={
                                                        bound.to
                                                            .iter()
                                                            .find_map(|v| v.as_time_str())
                                                            .unwrap_or_default()
                                                        }
                                                />
                                                <label
                                                    for={bound.colour.to_string()}
                                                    class={INPUT_LABEL_CSS}
                                                >
                                                    <i class="icon-clock"/>
                                                    {format!("{:?} up to: ", bound.colour)}
                                                </label>
                                            </div>
                                        },
                                        PracticeDataType::Duration => html! {
                                            <div class="relative">
                                                <input
                                                    id={bound.colour.to_string()}
                                                    autocomplete="off"
                                                    type="text"
                                                    inputmode="numeric"
                                                    placeholder={bound.colour.to_string()}
                                                    class={tw_merge!(INPUT_CSS, "text-center")}
                                                    onblur={
                                                        let onchange = onchange_bound_value.clone();
                                                        Callback::from(move |e: FocusEvent| {
                                                            let input: HtmlInputElement = e.target_unchecked_into();
                                                            onchange(input)
                                                        })
                                                    }
                                                    oninput={oninput_duration(backspace_key_pressed.clone())}
                                                    onkeydown={onkeydown_time_dur.clone()}
                                                    value={
                                                        bound.to
                                                            .iter()
                                                            .find_map(|v| v.as_duration_str())
                                                            .unwrap_or_default()
                                                        }
                                                />
                                                <label
                                                    for={bound.colour.to_string()}
                                                    class={INPUT_LABEL_CSS}
                                                >
                                                    <i class="icon-timer"/>
                                                    {format!("{:?} up to: ", bound.colour)}
                                                </label>
                                            </div>
                                        },
                                        _ => unreachable!()
                                    }
                                )}
                                <div class="relative">
                                    <select
                                        id="no_value_colour"
                                        disabled={!*color_zones_enabled}
                                        onchange={no_value_onchange}
                                        class={
                                            tw_merge!(
                                                "appearance-none text-center [text-align-last:center] has-value",
                                                INPUT_CSS)
                                        }
                                    >
                                        {for ZoneColour::iter().map(|zc| html!{
                                            <option
                                                class="text-black"
                                                selected={colour_zones_config.no_value_colour == zc}
                                                value={zc.to_string()}>{zc.to_string()}
                                            </option>
                                        })}
                                    </select>
                                    <label for="no_value_colour" class={INPUT_SELECT_LABEL_CSS}>
                                        <i class="icon-rounds"/>
                                        {" No value colour:"}
                                    </label>
                                </div>
                                <div class="relative">
                                    // <label>{"Preview:"}</label>
                                    // <label
                                    //     // for={idx.to_string()}
                                    //     class={INPUT_SELECT_LABEL_CSS}>
                                    //     <i class="icon-rounds"></i>{" Preview:"}
                                    // </label>
                                    <Grid
                                        color_coding={preview_heatmap_conf}
                                        data={preview_data}
                                        first_column_highlighted=false
                                    />
                                </div>
                                </div>
                            </SummaryDetails>
                        }
                    } else {
                        html!{}
                    }}
                    <div class="relative">
                        <button type="submit" class={SUBMIT_BTN_CSS}>{Locale::current().save()}</button>
                    </div>
                </div>
            </BlankPage>
        </form>
    }
}
