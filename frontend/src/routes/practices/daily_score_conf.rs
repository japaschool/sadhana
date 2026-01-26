use tw_merge::tw_merge;
use web_sys::HtmlInputElement;
use yew::prelude::*;

use crate::{
    components::summary_details::SummaryDetails,
    css::*,
    model::{BetterDirection, BonusRule, DailyScoreConfig, PracticeDataType, Value},
    tr,
    utils::time_dur_input_support::*,
};

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    pub config: DailyScoreConfig,
    pub data_type: PracticeDataType,
    pub on_change: Callback<DailyScoreConfig>,
}

#[function_component(DailyScoreConf)]
pub fn daily_score_conf(props: &Props) -> Html {
    // use_mut_ref is to avoid re-rendering on every key press
    let backspace_key_pressed = use_mut_ref(|| false);

    fn on_change<E, F>(props: &Props, f: F) -> Callback<E>
    where
        E: TargetCast + 'static,
        F: Fn(&mut DailyScoreConfig, &PracticeDataType, &HtmlInputElement) + 'static,
    {
        let config = props.config.clone();
        let cb = props.on_change.clone();
        let data_type = props.data_type;
        Callback::from(move |e: E| {
            let mut config = config.clone();
            let mut input: HtmlInputElement = e.target_unchecked_into();

            match data_type {
                PracticeDataType::Time if input.value() == TIME_PATTERN => input.set_value(""),
                PracticeDataType::Duration => format_duration(&mut input),
                _ => (),
            }

            f(&mut config, &data_type, &input);

            cb.emit(config);
        })
    }

    let better_when_onchange = on_change(props, |config, _, input| {
        config.better_direction = input
            .value()
            .as_str()
            .parse()
            .unwrap_or(BetterDirection::Higher);
    });

    let mandatory_onchange = on_change(props, |config, data_type, input| {
        let v = Value::try_from((data_type, input.value().as_str())).ok();
        config.mandatory_threshold = v;
    });

    let mandatory_oninput = on_change(props, |config, data_type, input| {
        let v = Value::try_from((data_type, input.value().as_str())).ok();
        config.mandatory_threshold = v;
    });

    let bonus_upd =
        |config: &mut DailyScoreConfig, data_type: &PracticeDataType, input: &HtmlInputElement| {
            let v = Value::try_from((data_type, input.value().as_str())).ok();
            if let Some(v) = v {
                if let Some(bonus_rule) = config.bonus_rules.first_mut() {
                    bonus_rule.threshold = v;
                } else {
                    config.bonus_rules.push(BonusRule {
                        threshold: v,
                        points: 1,
                    });
                }
            } else {
                config.bonus_rules.clear();
            }
        };

    let bonus_oninput = on_change(props, bonus_upd);

    let bonus_onchange = on_change(props, bonus_upd);

    let onkeydown = {
        let back = backspace_key_pressed.clone();
        Callback::from(move |e: KeyboardEvent| {
            *back.borrow_mut() = e.key() == "Backspace";
        })
    };

    html! {
        <SummaryDetails label={tr!(daily_score_title)}>
            <div class="relative">
                <div class="pt-2">
                    <p class="text-xs text-zinc-500 dark:text-zinc-200">
                        { tr!(daily_score_memo) }
                    </p>
                </div>
            </div>
            <div class={BODY_DIV_CSS}>
                <div class="relative">
                    <select
                        id="better_direction"
                        onchange={better_when_onchange}
                        class={tw_merge!("appearance-none text-center [text-align-last:center] has-value", INPUT_CSS)}
                    >
                        { for [BetterDirection::Higher, BetterDirection::Lower].iter().map(|d|
                            html! {
                                <option
                                    class={"text-black"}
                                    selected={props.config.better_direction == *d}
                                    value={d.to_string()}
                                >
                                    {d.to_localised_string()}
                                </option>
                            }
                        ) }
                    </select>
                    <label for="better_direction" class={INPUT_SELECT_LABEL_CSS}>
                        <i class="icon-rounds" />
                        { format!(" {}", tr!(colour_zones_better_when)) }
                    </label>
                </div>
                { match props.data_type {
                    PracticeDataType::Int => html! {
                    <>
                        <div class="relative">
                            <input
                                id="mandatory_threshold"
                                type="number"
                                inputmode="numeric"
                                min="0"
                                max="174"
                                autocomplete="off"
                                placeholder="Mandatory Minimum/Maximum"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                value={
                                    props.config.mandatory_threshold
                                        .as_ref()
                                        .map(|v| v.as_int().map(|i| i.to_string()).unwrap_or_default())
                                        .unwrap_or_default()
                                }
                                onchange={mandatory_onchange.clone()}
                            />
                            <label
                                for="mandatory_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-rounds"/>
                                { tr!(daily_score_mandatory_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_mandatory_memo) }
                                </p>
                            </div>
                        </div>
                        <div class="relative">
                            <input
                                id="bonus_threshold"
                                type="number"
                                inputmode="numeric"
                                min="0"
                                max="174"
                                autocomplete="off"
                                placeholder="Bonus Minimum/Maximum"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                value={
                                    props.config.bonus_rules
                                        .first()
                                        .map(|v| v.threshold.as_int().map(|i| i.to_string()).unwrap_or_default())
                                        .unwrap_or_default()
                                }
                                onchange={bonus_onchange.clone()}
                            />
                            <label
                                for="bonus_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-rounds"/>
                                { tr!(daily_score_bonus_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_bonus_memo) }
                                </p>
                            </div>
                        </div>
                    </>
                    },
                    PracticeDataType::Time => html! {
                    <>
                        <div class="relative">
                            <input
                                id="mandatory_threshold"
                                type="text"
                                inputmode="numeric"
                                autocomplete="off"
                                placeholder="Mandatory Minimum/Maximum"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                onblur={mandatory_oninput.clone()}
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
                                onkeydown={onkeydown.clone()}
                                value={
                                    props.config.mandatory_threshold
                                        .as_ref()
                                        .and_then(|v| v.as_time_str())
                                        .unwrap_or_default()
                                }
                            />
                            <label
                                for="mandatory_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-rounds"/>
                                { tr!(daily_score_mandatory_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_mandatory_memo) }
                                </p>
                            </div>
                        </div>
                        <div class="relative">
                            <input
                                id="bonus_threshold"
                                type="text"
                                inputmode="numeric"
                                autocomplete="off"
                                placeholder="Bonus Minimum/Maximum"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                onblur={bonus_oninput.clone()}
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
                                onkeydown={onkeydown.clone()}
                                value={
                                    props.config.bonus_rules
                                        .first()
                                        .and_then(|v| v.threshold.as_time_str())
                                        .unwrap_or_default()
                                }
                            />
                            <label
                                for="bonus_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-rounds"/>
                                { tr!(daily_score_bonus_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_bonus_memo) }
                                </p>
                            </div>
                        </div>
                    </>
                    },
                    PracticeDataType::Duration => html! {
                    <>
                        <div class="relative">
                            <input
                                id="mandatory_threshold"
                                autocomplete="off"
                                type="text"
                                inputmode="numeric"
                                placeholder="Mandatory Min/Max"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                onblur={mandatory_oninput.clone()}
                                oninput={oninput_duration(backspace_key_pressed.clone())}
                                onkeydown={onkeydown.clone()}
                                value={
                                    props.config.mandatory_threshold
                                        .as_ref()
                                        .and_then(|v| v.as_duration_str())
                                        .unwrap_or_default()
                                    }
                            />
                            <label
                                for="mandatory_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-timer"/>
                                { tr!(daily_score_mandatory_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_mandatory_memo) }
                                </p>
                            </div>
                        </div>
                        <div class="relative">
                            <input
                                id="bonus_threshold"
                                autocomplete="off"
                                type="text"
                                inputmode="numeric"
                                placeholder="Bonus Min/Max"
                                class={tw_merge!(INPUT_CSS, "text-center")}
                                onblur={bonus_oninput.clone()}
                                oninput={oninput_duration(backspace_key_pressed.clone())}
                                onkeydown={onkeydown.clone()}
                                value={
                                    props.config.bonus_rules
                                        .first()
                                        .and_then(|v| v.threshold.as_duration_str())
                                        .unwrap_or_default()
                                    }
                            />
                            <label
                                for="bonus_threshold"
                                class={INPUT_LABEL_CSS}
                            >
                                <i class="icon-timer"/>
                                { tr!(daily_score_bonus_value) }
                            </label>
                            <div class="pt-2">
                                <p class="text-xs text-zinc-500 dark:text-zinc-200">
                                    { tr!(daily_score_bonus_memo) }
                                </p>
                            </div>
                        </div>
                    </>
                    },
                    _ => unreachable!()
                } }
            </div>
        </SummaryDetails>
    }
}
