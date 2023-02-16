use yew::prelude::*;
use yew_plotly::plotly::color::NamedColor;
use yew_plotly::plotly::common::{Font, Marker};
use yew_plotly::plotly::configuration::DisplayModeBar;
use yew_plotly::plotly::layout::{Axis, Margin};
use yew_plotly::plotly::{Bar, Configuration, Layout, Plot};
use yew_plotly::Plotly;

use crate::model::PracticeDataType;

#[derive(Properties, Clone, PartialEq)]
pub struct Props {
    #[prop_or_default]
    pub x_values: Vec<String>,
    #[prop_or_default]
    pub y_values: Vec<String>,
    #[prop_or_default]
    pub y_axis_type: Option<PracticeDataType>,
}

#[function_component(Chart)]
pub fn chart(props: &Props) -> Html {
    let mut plot = Plot::new();

    let mut layout = Layout::new()
        .paper_background_color(NamedColor::Transparent)
        .plot_background_color(NamedColor::Transparent)
        .font(Font::new().color(NamedColor::White))
        .margin(Margin::new().left(40).right(20).top(10))
        .auto_size(true);

    if let Some(PracticeDataType::Time) = props.y_axis_type {
        layout = layout.y_axis(Axis::new().tick_format("%H:%M"))
    }

    let config = Configuration::default()
        .display_mode_bar(DisplayModeBar::False)
        .static_plot(true);

    let trace = Bar::new(props.x_values.clone(), props.y_values.clone())
        .marker(Marker::new().color(NamedColor::White))
        .opacity(0.5);

    plot.add_trace(trace);
    plot.set_layout(layout);
    plot.set_configuration(config);

    html! {
        <Plotly plot={ plot }/>
    }
}
