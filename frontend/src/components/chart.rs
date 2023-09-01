use yew::prelude::*;
use yew_plotly::plotly::color::NamedColor;
use yew_plotly::plotly::common::{Font, Marker, Mode, Position};
use yew_plotly::plotly::configuration::DisplayModeBar;
use yew_plotly::plotly::layout::{Axis, AxisType, Margin};
use yew_plotly::plotly::{Bar, Configuration, Layout, Plot, Scatter};
use yew_plotly::Plotly;

use crate::i18n::*;
use crate::model::PracticeDataType;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub x_values: Vec<String>,
    #[prop_or_default]
    pub y_values: Vec<String>,
    #[prop_or_default]
    pub y_axis_type: Option<PracticeDataType>,
    #[prop_or_default]
    pub avg_value_and_label: Option<(String, String)>,
}

#[function_component(Chart)]
pub fn chart(props: &Props) -> Html {
    let mut plot = Plot::new();

    let mut layout = Layout::new()
        .paper_background_color(NamedColor::Transparent)
        .plot_background_color(NamedColor::Transparent)
        .font(Font::new().color(NamedColor::DarkGray))
        .margin(Margin::new().left(40).right(40).top(10))
        .show_legend(false)
        .auto_size(true);

    let mut y_axis = Axis::new().fixed_range(true);

    if let Some(PracticeDataType::Time) = props.y_axis_type {
        y_axis = y_axis.tick_format("%H:%M");
    }

    if let Some(PracticeDataType::Duration) = props.y_axis_type {
        y_axis = y_axis
            .type_(AxisType::Linear)
            .tick_suffix(Locale::current().minutes_label());
    }

    layout = layout.y_axis(y_axis.clone());

    let config = Configuration::default()
        .display_mode_bar(DisplayModeBar::False)
        .static_plot(true);

    let trace = Bar::new(props.x_values.clone(), props.y_values.clone())
        .marker(Marker::new().color(NamedColor::DarkOrange))
        .name("")
        .opacity(0.5);

    if let Some((avg_value, label_value)) = props.avg_value_and_label.as_ref() {
        let trace_avg = Scatter::new(
            props.x_values.clone(),
            vec![avg_value.clone(); props.y_values.len()],
        )
        .name("")
        .text_array(
            props
                .x_values
                .iter()
                .enumerate()
                .map(|(idx, _)| {
                    if idx == 0 {
                        Locale::current().on_average(Qty(label_value))
                    } else {
                        "".to_string()
                    }
                })
                .collect::<Vec<_>>(),
        )
        .text_position(Position::TopRight)
        .mode(Mode::LinesText);
        plot.add_trace(trace_avg);
    }

    plot.add_trace(trace);
    plot.set_layout(layout);
    plot.set_configuration(config);

    html! {
        <Plotly plot={plot}/>
    }
}
